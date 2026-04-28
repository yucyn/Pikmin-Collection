window.CollageModule = (function () {
  let canvas;
  let libraryGrid;
  let scaleRange;
  let rotateRange;
  let exportBtn;
  let clearBtn;
  let removeBtn;
  let bringFrontBtn;
  let selectedItem = null;
  let zIndexCounter = 1;
  let pointerState = null;

  function init() {
    canvas = document.getElementById("collageCanvas");
    libraryGrid = document.getElementById("collageLibraryGrid");
    scaleRange = document.getElementById("collageScaleRange");
    rotateRange = document.getElementById("collageRotateRange");
    exportBtn = document.getElementById("collageExportBtn");
    clearBtn = document.getElementById("collageClearBtn");
    removeBtn = document.getElementById("collageRemoveBtn");
    bringFrontBtn = document.getElementById("collageBringFrontBtn");

    if (!canvas || !libraryGrid) return;

    scaleRange.addEventListener("input", function () {
      if (!selectedItem) return;
      selectedItem.dataset.scale = String(Number(scaleRange.value) / 100);
      applyTransform(selectedItem);
    });

    rotateRange.addEventListener("input", function () {
      if (!selectedItem) return;
      selectedItem.dataset.rotate = String(Number(rotateRange.value));
      applyTransform(selectedItem);
    });

    clearBtn.addEventListener("click", clearCanvas);
    removeBtn.addEventListener("click", removeSelected);
    bringFrontBtn.addEventListener("click", bringSelectedFront);
    exportBtn.addEventListener("click", exportCanvas);

    canvas.addEventListener("pointerdown", function (event) {
      if (event.target === canvas) {
        selectItem(null);
      }
    });
  }

  function refreshLibrary(postcards) {
    if (!libraryGrid) return;

    libraryGrid.innerHTML = "";

    if (!postcards || postcards.length === 0) {
      const empty = document.createElement("div");
      empty.className = "collage-library-card";
      empty.textContent = "目前沒有可拼貼的明信片";
      libraryGrid.appendChild(empty);
      return;
    }

    postcards.forEach(function (item, index) {
      const card = document.createElement("article");
      card.className = "collage-library-card";

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "postcard";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `No.${String(index + 1).padStart(3, "0")}｜${item.category || "全球"}`;
      const location = document.createElement("span");
      location.textContent = item.locationText || "";

      info.appendChild(title);
      info.appendChild(location);

      const addButton = document.createElement("button");
      addButton.className = "collage-add-button";
      addButton.type = "button";
      addButton.textContent = "+";
      addButton.title = "加入拼貼";
      addButton.addEventListener("click", function () {
        addImageToCanvas(item.image);
      });

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(addButton);
      libraryGrid.appendChild(card);
    });
  }

  function updateEmptyHint() {
    const hint = canvas.querySelector(".collage-empty-hint");
    const hasItems = canvas.querySelectorAll(".collage-item").length > 0;
    if (hint) hint.classList.toggle("hidden", hasItems);
  }

  function addImageToCanvas(src) {
    const item = document.createElement("div");
    item.className = "collage-item";
    item.dataset.scale = "1";
    item.dataset.rotate = "0";
    item.dataset.x = String(40 + Math.random() * 80);
    item.dataset.y = String(40 + Math.random() * 80);
    item.style.zIndex = String(++zIndexCounter);

    const image = document.createElement("img");
    image.src = src;
    image.alt = "collage item";

    item.appendChild(image);
    canvas.appendChild(item);

    item.addEventListener("pointerdown", startDrag);
    item.addEventListener("click", function (event) {
      event.stopPropagation();
      selectItem(item);
    });

    applyTransform(item);
    selectItem(item);
    updateEmptyHint();
  }

  function selectItem(item) {
    if (selectedItem) selectedItem.classList.remove("selected");
    selectedItem = item;

    if (selectedItem) {
      selectedItem.classList.add("selected");
      scaleRange.value = String(Math.round(Number(selectedItem.dataset.scale || "1") * 100));
      rotateRange.value = String(Number(selectedItem.dataset.rotate || "0"));
    }
  }

  function startDrag(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = event.currentTarget;
    selectItem(item);

    const rect = canvas.getBoundingClientRect();

    pointerState = {
      item,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalX: Number(item.dataset.x || "0"),
      originalY: Number(item.dataset.y || "0"),
      canvasRect: rect
    };

    item.setPointerCapture(event.pointerId);
    item.addEventListener("pointermove", moveDrag);
    item.addEventListener("pointerup", endDrag);
    item.addEventListener("pointercancel", endDrag);
  }

  function moveDrag(event) {
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;

    const dx = event.clientX - pointerState.startX;
    const dy = event.clientY - pointerState.startY;

    const nextX = pointerState.originalX + dx;
    const nextY = pointerState.originalY + dy;

    pointerState.item.dataset.x = String(nextX);
    pointerState.item.dataset.y = String(nextY);

    applyTransform(pointerState.item);
  }

  function endDrag(event) {
    if (!pointerState || pointerState.pointerId !== event.pointerId) return;

    const item = pointerState.item;
    item.releasePointerCapture(event.pointerId);
    item.removeEventListener("pointermove", moveDrag);
    item.removeEventListener("pointerup", endDrag);
    item.removeEventListener("pointercancel", endDrag);

    pointerState = null;
  }

  function applyTransform(item) {
    const x = Number(item.dataset.x || "0");
    const y = Number(item.dataset.y || "0");
    const scale = Number(item.dataset.scale || "1");
    const rotate = Number(item.dataset.rotate || "0");

    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    item.style.transform = `scale(${scale}) rotate(${rotate}deg)`;
  }

  function removeSelected() {
    if (!selectedItem) return;
    selectedItem.remove();
    selectedItem = null;
    updateEmptyHint();
  }

  function clearCanvas() {
    if (!confirm("確定要清空拼貼畫布嗎？")) return;
    canvas.querySelectorAll(".collage-item").forEach(item => item.remove());
    selectedItem = null;
    updateEmptyHint();
  }

  function bringSelectedFront() {
    if (!selectedItem) return;
    selectedItem.style.zIndex = String(++zIndexCounter);
  }

  async function exportCanvas() {
    const items = Array.from(canvas.querySelectorAll(".collage-item"));

    if (items.length === 0) {
      alert("請先加入圖片再匯出");
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleFactor = 2;

    const output = document.createElement("canvas");
    output.width = Math.round(rect.width * scaleFactor);
    output.height = Math.round(rect.height * scaleFactor);

    const ctx = output.getContext("2d");
    drawBackground(ctx, output.width, output.height, scaleFactor);

    const sortedItems = items.sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0));

    for (const item of sortedItems) {
      const img = item.querySelector("img");
      if (!img) continue;

      await drawItem(ctx, img, item, scaleFactor);
    }

    const link = document.createElement("a");
    link.download = `pikmin-collage-${Date.now()}.png`;
    link.href = output.toDataURL("image/png");
    link.click();
  }

  function drawBackground(ctx, width, height, scaleFactor) {
    ctx.fillStyle = "#fffef8";
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(110, 112, 99, 0.20)";
    const gap = 18 * scaleFactor;

    for (let x = gap; x < width; x += gap) {
      for (let y = gap; y < height; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 * scaleFactor, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawItem(ctx, img, item, scaleFactor) {
    return new Promise(resolve => {
      const image = new Image();
      image.crossOrigin = "anonymous";

      image.onload = function () {
        const x = Number(item.dataset.x || "0") * scaleFactor;
        const y = Number(item.dataset.y || "0") * scaleFactor;
        const baseWidth = item.offsetWidth * scaleFactor;
        const baseHeight = (item.offsetWidth * (image.naturalHeight / image.naturalWidth)) * scaleFactor;
        const scale = Number(item.dataset.scale || "1");
        const rotate = Number(item.dataset.rotate || "0") * Math.PI / 180;

        ctx.save();
        ctx.translate(x + baseWidth / 2, y + baseHeight / 2);
        ctx.rotate(rotate);
        ctx.scale(scale, scale);
        roundImage(ctx, image, -baseWidth / 2, -baseHeight / 2, baseWidth, baseHeight, 16 * scaleFactor);
        ctx.restore();
        resolve();
      };

      image.onerror = function () {
        resolve();
      };

      image.src = img.src;
    });
  }

  function roundImage(ctx, image, x, y, width, height, radius) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
  }

  return {
    init,
    refreshLibrary
  };
})();
