let currentImageData = null;

function setCurrentImageData(imageData) {
  currentImageData = imageData;
}

function getCurrentImageData() {
  return currentImageData;
}

function clearCurrentImageData() {
  currentImageData = null;
}

function isImageFile(file) {
  return file && file.type && file.type.startsWith("image/");
}

function getFirstImageFile(fileList) {
  return Array.from(fileList || []).find(isImageFile);
}

function readImageFile(file, onLoaded, onError) {
  if (!isImageFile(file)) {
    onError("請選擇或拖曳圖片檔案");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    onLoaded(event.target.result);
  };

  reader.onerror = function () {
    onError("圖片讀取失敗，請重新嘗試");
  };

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
    const firstUri = uri
      .split("\n")
      .map(line => line.trim())
      .find(line => line && !line.startsWith("#"));
    if (firstUri) return firstUri;
  }

  const plain = dataTransfer.getData("text/plain");
  if (plain) {
    const match = plain.match(/data:image\/[^\s]+|blob:[^\s]+|https?:\/\/\S+/);
    if (match) return match[0];
  }

  return null;
}

function setupImageUpload({
  fileInput,
  selectFileBtn,
  dropZone,
  pasteZone,
  onImageLoaded,
  onError
}) {
  selectFileBtn.addEventListener("click", function () {
    fileInput.click();
  });

  fileInput.addEventListener("change", function (event) {
    const file = getFirstImageFile(event.target.files);
    readImageFile(file, onImageLoaded, onError);
    fileInput.value = "";
  });

  ["dragenter", "dragover", "drop"].forEach(eventName => {
    window.addEventListener(eventName, function (event) {
      event.preventDefault();
    }, false);
  });

  dropZone.addEventListener("dragenter", function (event) {
    event.preventDefault();
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragover", function (event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    dropZone.classList.add("dragover");
  });

  dropZone.addEventListener("dragleave", function () {
    dropZone.classList.remove("dragover");
  });

  dropZone.addEventListener("drop", function (event) {
    event.preventDefault();
    dropZone.classList.remove("dragover");

    const file = getFirstImageFile(event.dataTransfer.files);

    if (file) {
      readImageFile(file, onImageLoaded, onError);
      return;
    }

    const imageUrl = extractImageUrlFromDataTransfer(event.dataTransfer);

    if (imageUrl) {
      onImageLoaded(imageUrl);
      return;
    }

    onError("沒有讀到圖片。LINE 請使用「貼上圖片」模式。");
  });

  pasteZone.addEventListener("click", function () {
    pasteZone.focus();
  });

  pasteZone.addEventListener("paste", function (event) {
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
        onImageLoaded(match[0]);
        return;
      }
    }

    onError("剪貼簿沒有圖片。請先複製圖片，再貼上。");
  });
}
