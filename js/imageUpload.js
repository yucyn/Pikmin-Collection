let currentImageData = null;

const IMAGE_MAX_WIDTH = 800;
const IMAGE_QUALITY = 0.65;
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
  const width = Math.round(image.width * ratio);
  const height = Math.round(image.height * ratio);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0, width, height);

  let quality = IMAGE_QUALITY;
  let compressed = canvas.toDataURL("image/jpeg", quality);

  while (getDataUrlSizeBytes(compressed) > FIRESTORE_SAFE_LIMIT_BYTES && quality > 0.35) {
    quality -= 0.1;
    compressed = canvas.toDataURL("image/jpeg", quality);
  }

  return compressed;
}

function readImageFile(file, onLoaded, onError) {
  if (!isImageFile(file)) {
    onError("請選擇或拖曳圖片檔案");
    return;
  }

  const reader = new FileReader();

  reader.onload = async event => {
    try {
      const compressed = await compressImageDataUrl(event.target.result);
      if (getDataUrlSizeBytes(compressed) > FIRESTORE_SAFE_LIMIT_BYTES) {
        onError("圖片仍然太大，請改用較小圖片或截圖後再上傳");
        return;
      }
      onLoaded(compressed);
    } catch (error) {
      console.error(error);
      onError("圖片壓縮失敗，請重新嘗試");
    }
  };

  reader.onerror = () => onError("圖片讀取失敗，請重新嘗試");
  reader.readAsDataURL(file);
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
    const match = plain.match(/data:image\/[^\s]+|blob:[^\s]+|https?:\/\/\S+/);
    if (match) return match[0];
  }

  return null;
}

async function imageUrlToCompressedDataUrl(imageUrl, onError) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();

    if (!blob.type.startsWith("image/")) {
      onError("拖曳的網址不是圖片");
      return null;
    }

    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async event => {
        try { resolve(await compressImageDataUrl(event.target.result)); }
        catch (error) { reject(error); }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return imageUrl;
  }
}

function setupImageUpload({ fileInput, selectFileBtn, dropZone, pasteZone, onImageLoaded, onError }) {
  selectFileBtn.addEventListener("click", () => fileInput.click());

  fileInput.addEventListener("change", event => {
    const file = getFirstImageFile(event.target.files);
    readImageFile(file, onImageLoaded, onError);
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

  dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dropover"));

  dropZone.addEventListener("drop", async event => {
    event.preventDefault();
    dropZone.classList.remove("dropover");

    const file = getFirstImageFile(event.dataTransfer.files);

    if (file) {
      readImageFile(file, onImageLoaded, onError);
      return;
    }

    const imageUrl = extractImageUrlFromDataTransfer(event.dataTransfer);

    if (imageUrl) {
      const imageData = await imageUrlToCompressedDataUrl(imageUrl, onError);
      if (imageData) onImageLoaded(imageData);
      return;
    }

    onError("沒有讀到圖片。LINE 請使用「貼上圖片」模式。");
  });

  pasteZone.addEventListener("click", () => pasteZone.focus());

  pasteZone.addEventListener("paste", event => {
    const items = Array.from(event.clipboardData?.items || []);
    const imageItem = items.find(item => item.type && item.type.startsWith("image/"));

    if (imageItem) {
      readImageFile(imageItem.getAsFile(), onImageLoaded, onError);
      return;
    }

    const text = event.clipboardData?.getData("text/plain");
    if (text) {
      const match = text.match(/data:image\/[^\s]+|https?:\/\/\S+/);
      if (match) {
        imageUrlToCompressedDataUrl(match[0], onError).then(imageData => {
          if (imageData) onImageLoaded(imageData);
        });
        return;
      }
    }

    onError("剪貼簿沒有圖片。請先複製圖片，再貼上。");
  });
}
