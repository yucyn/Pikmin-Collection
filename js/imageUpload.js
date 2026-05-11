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
 * V41.1 優化：自動判定明信片類型 (花 vs 蘑菇)
 * 利用 Canvas 像素分析特定區域的特徵顏色
 */
async function detectTagFromImage(imageDataUrl) {
  const image = await loadImageFromDataUrl(imageDataUrl);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  
  // 使用明信片常見的橫向比例 (600x400) 進行分析
  canvas.width = 600;
  canvas.height = 400; 
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  // --- 優先判定：大花 (Flower) ---
  // 特徵：右下角廣域 (x: 380~600, y: 180~400) 有厚白邊貼紙圖案
  const flowerArea = ctx.getImageData(380, 180, 210, 210);
  let whiteBorderPixels = 0;
  let flowerColorPixels = 0;
  for (let i = 0; i < flowerArea.data.length; i += 4) {
    const r = flowerArea.data[i];
    const g = flowerArea.data[i+1];
    const b = flowerArea.data[i+2];
    
    // 偵測大花的純白邊
    if (r > 240 && g > 240 && b > 240) whiteBorderPixels++;
    // 偵測花朵色彩
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if ((max - min) > 60 && max > 160) flowerColorPixels++;
  }
  
  // 只要右下角有明顯白邊特徵與鮮豔色彩，判定為花
  if (whiteBorderPixels > 500 && flowerColorPixels > 100) return "花";


  // --- 次要判定：蘑菇 (Mushroom) ---
  // 特徵：資訊方塊內必須同時具備「黃色星星」、「黑色文字」與「綠色蓋章」
  const mushroomArea = ctx.getImageData(360, 180, 220, 180);
  let starYellowCount = 0;
  let textBlackCount = 0;
  let clearedGreenCount = 0;
  for (let i = 0; i < mushroomArea.data.length; i += 4) {
    const r = mushroomArea.data[i];
    const g = mushroomArea.data[i+1];
    const b = mushroomArea.data[i+2];
    
    // 1. 偵測黃色 (星星)
    if (r > 200 && g > 170 && b < 100) {
      starYellowCount++;
    }
    // 2. 偵測黑色/深色 (蘑菇名稱與點數文字)
    if (r < 100 && g < 100 && b < 100) {
      textBlackCount++;
    }
    // 3. 偵測綠色 (蓋章)
    if (g > 130 && g > r * 1.5 && g > b * 1.5 && r < 140 && b < 140) {
      clearedGreenCount++;
    }
  }

  // 蘑菇判定：調降門檻，適應少星星與少字的情況
  if (starYellowCount > 40 && textBlackCount > 80 && clearedGreenCount > 30) {
    return "蘑菇";
  }

  // 既非大花也非蘑菇，則判定為隱藏 (一般明信片)
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
