let currentImageData = null;

const IMAGE_MAX_WIDTH = 1200;
const IMAGE_QUALITY = 0.72;
const FIRESTORE_SAFE_LIMIT_BYTES = 850 * 1024;

function setCurrentImageData(imageData) { currentImageData = imageData; }
function getCurrentImageData() { return currentImageData; }
function clearCurrentImageData() { currentImageData = null; }

function isImageFile(file) {
  return file && file.type && file.type.startsWith("image/");
}

function getFirstImageFile(fileList) {
  return Array.from(fileList || []).find(isImageFile);
}

function getDataUrlSizeBytes(dataUrl) {
  const base64 = String(dataUrl).split(",")[1] || "";
  return Math.ceil(base64.length * 0.75);
}

function loadImageFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("圖片載入失敗"));
    image.src = dataUrl;
  });
}

async function compressImageDataUrl(originalDataUrl) {
  const image = await loadImageFromDataUrl(originalDataUrl);
  const ratio = Math.min(1, IMAGE_MAX_WIDTH / image.width);
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);

  let quality = IMAGE_QUALITY;
  let compressed = canvas.toDataURL("image/jpeg", quality);

  while (getDataUrlSizeBytes(compressed) > FIRESTORE_SAFE_LIMIT_BYTES && quality > 0.32) {
    quality -= 0.08;
    compressed = canvas.toDataURL("image/jpeg", quality);
  }

  return compressed;
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => resolve(event.target.result);
    reader.onerror = () => reject(new Error("圖片讀取失敗"));
    reader.readAsDataURL(file);
  });
}

/**
 * V41.1 HOTFIX：自動判定明信片類型 (花 vs 蘑菇)
 * 規則：橫向照片才進行判定，縱向 (藍色框) 預設為隱藏。
 */
async function detectTagFromImage(imageDataUrl) {
  const image = await loadImageFromDataUrl(imageDataUrl);
  
  // --- 規則 1：判定為縱向照片 (Portrait) -> 隱藏 ---
  if (image.height > image.width) {
    return "隱藏";
  }

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  // 使用明信片常見的橫向比例 (600x400) 進行分析
  canvas.width = 600;
  canvas.height = 400; 
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // --- 判定範圍：右側標籤欄 (x: 68%~100%, y: 0%~100%) ---
  // 換算為 600x400 畫布：x 起始約為 408
  const scanX = 408;
  const scanY = 0;
  const scanW = 600 - scanX;
  const scanH = 400;
  const scanArea = ctx.getImageData(scanX, scanY, scanW, scanH);

  let starYellowCount = 0;
  let textBlackCount = 0;
  let clearedGreenCount = 0;
  let pureWhitePixels = 0;
  let vibrantColorPixels = 0;
  let blueBoxPixels = 0;

  for (let i = 0; i < scanArea.data.length; i += 4) {
    const r = scanArea.data[i];
    const g = scanArea.data[i+1];
    const b = scanArea.data[i+2];
    
    // A. 偵測藍色框 (特殊純色樣式判定)
    if (b > r * 1.3 && b > g * 1.3 && b > 80) {
      blueBoxPixels++;
    }
    // B. 偵測黃色 (星星或黃花)
    if (r > 200 && g > 170 && b < 120) {
      starYellowCount++;
    }
    // C. 偵測黑色/深色 (文字)
    if (r < 110 && g < 110 && b < 110) {
      textBlackCount++;
    }
    // D. 偵測綠色 (CLEARED! 蓋章或文字)
    if (g > 110 && g > r * 1.15 && g > b * 1.1) {
      clearedGreenCount++;
    }
    // E. 偵測純白像素 (大花貼紙的白色描邊/外框)
    if (r > 240 && g > 240 && b > 240) {
      pureWhitePixels++;
    }
    // F. 偵測鮮豔色彩 (花瓣色彩)
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if ((max - min) > 55 && max > 140) {
      vibrantColorPixels++;
    }
  }

  // --- 判定 1：花 (最高優先) ---
  // 規則：大型花朵圖案 + 白色描邊/外框
  // 顏色不限 (紅、黃、藍、白、紫等)
  const isFlowerPattern = (vibrantColorPixels > 800 || starYellowCount > 1000);
  const hasFlowerBorder = (pureWhitePixels > 1200); // 增加門檻以匹配全高度掃描
  
  if (isFlowerPattern && hasFlowerBorder) {
    return "花";
  }
  // 白色大花特徵 (極多純白像素 + 少量色彩中心)
  if (pureWhitePixels > 8000 && vibrantColorPixels > 50) {
    return "花";
  }

  // --- 判定 2：蘑菇 (次要優先，需 AND 三個條件) ---
  // 1. 星星數 (starYellowCount)
  // 2. 蘑菇文字 (textBlackCount)
  // 3. CLEARED! 文字 (clearedGreenCount)
  const mushroomCondition = (starYellowCount > 40 && textBlackCount > 100 && clearedGreenCount > 20);
  
  // 排除：藍色框或超大面積單色 (非貼紙)
  const isBlueBoxStyle = (blueBoxPixels > (scanArea.data.length / 4) * 0.4);

  if (mushroomCondition && !isBlueBoxStyle) {
    return "蘑菇";
  }

  // --- 判定 3：隱藏 (最後判定) ---
  return "隱藏";
}

async function processImageFile(file, onImageLoaded, onError, onStart, onDone) {
  if (!isImageFile(file)) {
    onError("請選擇、拖曳或貼上圖片檔案");
    return;
  }

  try {
    onStart?.("圖片處理中…");
    const original = await readFileAsDataUrl(file);
    const compressed = await compressImageDataUrl(original);

    if (getDataUrlSizeBytes(compressed) > FIRESTORE_SAFE_LIMIT_BYTES) {
      onError("圖片仍然太大，請改用較小圖片或截圖後再上傳");
      return;
    }

    // 自動偵測標籤
    const detectedTag = await detectTagFromImage(compressed);

    onImageLoaded(compressed, detectedTag); // 傳回判定結果
  } catch (error) {
    console.error(error);
    onError("圖片讀取或壓縮失敗，請重新嘗試");
  } finally {
    onDone?.();
  }
}

function readImageFile(file, onLoaded, onError) {
  processImageFile(file, onLoaded, onError);
}

function extractImageUrlFromDataTransfer(dataTransfer) {
  const html = dataTransfer.getData("text/html");

  if (html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const img = doc.querySelector("img");
    if (img && img.src) return img.src;
  }

  const uri = dataTransfer.getData("text/uri-list");
  if (uri) {
    const firstUri = uri.split("\n").map(line => line.trim()).find(line => line && !line.startsWith("#"));
    if (firstUri) return firstUri;
  }

  const plain = dataTransfer.getData("text/plain");
  if (plain) {
    const match = plain.match(/data:image\/[^^\s]+|blob:[^\s]+|https?:\/\/\S+/);
    if (match) return match[0];
  }

  return null;
}

async function imageUrlToCompressedDataUrl(imageUrl, onError) {
  if (String(imageUrl).startsWith("data:image/")) {
    return compressImageDataUrl(imageUrl);
  }

  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      onError("拖曳的網址不是圖片");
      return null;
    }

    const original = await readFileAsDataUrl(blob);
    return await compressImageDataUrl(original);
  } catch (error) {
    console.warn(error);
    onError("無法讀取外部圖片網址，請改用截圖、下載後上傳，或 Ctrl+V 貼上圖片");
    return null;
  }
}

function setFileInputFiles(fileInput, file) {
  // V33：用 DataTransfer 寫入 input.files，避免第一次拖曳失敗。
  const dt = new DataTransfer();
  dt.items.add(file);
  fileInput.files = dt.files;
  fileInput.dispatchEvent(new Event("change", { bubbles: true }));
}

function setupImageUpload({ fileInput, selectFileBtn, dropZone, pasteZone, onImageLoaded, onError, onStart, onDone }) {
  if (!fileInput || !selectFileBtn || !dropZone) return;

  const start = message => {
    dropZone.classList.add("upload-loading");
    onStart?.(message || "圖片處理中…");
  };

  const done = () => {
    dropZone.classList.remove("upload-loading");
    onDone?.();
  };

  const loadFile = file => processImageFile(file, onImageLoaded, onError, start, done);

  selectFileBtn.addEventListener("click", event => {
    event.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener("click", event => {
    if (event.target === selectFileBtn) return;
    if (event.target.closest("#clearImageBtn")) return;
    fileInput.click();
  });

  dropZone.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInput.click();
    }
  });

  fileInput.addEventListener("change", event => {
    const file = getFirstImageFile(event.target.files);
    if (file) loadFile(file);
    fileInput.value = "";
  });

  ["dragenter", "dragover", "drop"].forEach(eventName => {
    window.addEventListener(eventName, event => event.preventDefault(), false);
  });

  dropZone.addEventListener("dragenter", event => {
    event.preventDefault();
    dropZone.classList.add("dropover");
  });

  dropZone.addEventListener("dragover", event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("dropover");
  });

  dropZone.addEventListener("dragleave", event => {
    if (!dropZone.contains(event.relatedTarget)) {
      dropZone.classList.remove("dropover");
    }
  });

  dropZone.addEventListener("drop", async event => {
    event.preventDefault();
    event.stopPropagation();
    dropZone.classList.remove("dropover");

    const file = getFirstImageFile(event.dataTransfer.files);

    if (file) {
      // 先同步到 input，再由原本 change 流程處理，第一次拖曳也會成功。
      setFileInputFiles(fileInput, file);
      return;
    }

    const imageUrl = extractImageUrlFromDataTransfer(event.dataTransfer);

    if (imageUrl) {
      try {
        start("圖片讀取中…");
        const imageData = await imageUrlToCompressedDataUrl(imageUrl, onError);
        if (imageData) {
          // V41.1：URL 拖曳也要執行自動判定
          const detectedTag = await detectTagFromImage(imageData);
          onImageLoaded(imageData, detectedTag);
        }
      } finally {
        done();
      }
      return;
    }

    onError("沒有讀到圖片。請改用上傳檔案、拖曳圖片檔，或 Ctrl+V 貼上圖片。");
  });

  function handlePasteImage(event) {
    const target = event.target;
    const tagName = String(target?.tagName || "").toLowerCase();
    const isTypingField = tagName === "input" || tagName === "textarea" || target?.isContentEditable;

    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(item => item.type && item.type.startsWith("image/"));

    if (imageItem) {
      event.preventDefault();
      const file = imageItem.getAsFile();
      if (file) {
        dropZone.classList.add("upload-success");
        setFileInputFiles(fileInput, file);
        setTimeout(() => dropZone.classList.remove("upload-success"), 900);
      }
      return;
    }

    if (!isTypingField && event.target === pasteZone) {
      onError("剪貼簿沒有圖片。請先複製圖片，再貼上。");
    }
  }

  pasteZone?.addEventListener("click", () => pasteZone.focus());
  pasteZone?.addEventListener("paste", handlePasteImage);
  document.addEventListener("paste", handlePasteImage);
}

// 導出到全域
window.setupImageUpload = setupImageUpload;
window.compressImageDataUrl = compressImageDataUrl;
window.readFileAsDataUrl = readFileAsDataUrl;
window.getDataUrlSizeBytes = getDataUrlSizeBytes;
window.FIRESTORE_SAFE_LIMIT_BYTES = FIRESTORE_SAFE_LIMIT_BYTES;
