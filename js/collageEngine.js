window.CollageEngine = (function () {
  let canvas;
  let brushCanvas;
  let brushCtx;
  let libraryGrid;
  let toolbar;
  let selectedItem = null;
  let zIndexCounter = 10;
  let history = [];
  let historyIndex = -1;
  let options = {};
  let activeInteraction = null;
  let brushMode = false;
  let isDrawing = false;
  let currentBg = "#fffef8";

  function init(initOptions = {}) {
    options = initOptions;
    canvas = document.getElementById("collageCanvas");
    brushCanvas = document.getElementById("collageBrushCanvas");
    libraryGrid = document.getElementById("collageLibraryGrid");
    toolbar = document.getElementById("collageFloatingToolbar");

    if (!canvas || !brushCanvas || !libraryGrid) return;

    brushCtx = brushCanvas.getContext("2d");
    resizeBrushCanvas();

    window.addEventListener("resize", resizeBrushCanvas);

    bindToolbar();
    bindCanvas();
    bindBrush();
    saveHistory();
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

    postcards.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "collage-library-card";

      const img = document.createElement("img");
      img.src = item.image;
      img.alt = "postcard";

      const info = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `No.${String(index + 1).padStart(3, "0")}｜${item.category || "全球"}`;

      const loc = document.createElement("span");
      loc.textContent = item.locationText || "";

      info.appendChild(title);
      info.appendChild(loc);

      const add = document.createElement("button");
      add.className = "collage-add-button";
      add.type = "button";
      add.textContent = "+";
      add.addEventListener("click", () => {
        addImage(item.image);
      });

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(add);
      libraryGrid.appendChild(card);
    });
  }

  function bindToolbar() {
    document.getElementById("collageBackBtn")?.addEventListener("click", () => options.onBackToCollection?.());
    document.getElementById("collageUndoBtn")?.addEventListener("click", undo);
    document.getElementById("collageRedoBtn")?.addEventListener("click", redo);
    document.getElementById("collageClearBtn")?.addEventListener("click", clearCanvas);
    document.getElementById("collageExportBtn")?.addEventListener("click", exportPng);

    document.getElementById("collageDuplicateBtn")?.addEventListener("click", duplicateSelected);
    document.getElementById("collageDeleteBtn")?.addEventListener("click", deleteSelected);
    document.getElementById("collageCropBtn")?.addEventListener("click", toggleCropSelected);
    document.getElementById("collageFrontBtn")?.addEventListener("click", bringForward);
    document.getElementById("collageBackLayerBtn")?.addEventListener("click", sendBackward);

    document.getElementById("collageAddTextBtn")?.addEventListener("click", addText);
    document.getElementById("collageTextToolBtn")?.addEventListener("click", addText);

    document.getElementById("collageAddBrushBtn")?.addEventListener("click", toggleBrushMode);
    document.getElementById("collageBrushToolBtn")?.addEventListener("click", toggleBrushMode);
    document.getElementById("collageImageToolBtn")?.addEventListener("click", () => {
      brushMode = false;
      canvas.classList.remove("brush-mode");
    });

    document.getElementById("collageBgColor")?.addEventListener("input", event => {
      setBackground(event.target.value);
    });

    document.querySelectorAll(".bg-swatch").forEach(button => {
      button.addEventListener("click", () => setBackground(button.dataset.bg));
    });
  }

  function bindCanvas() {
    canvas.addEventListener("pointerdown", event => {
      if (event.target === canvas) selectItem(null);
    });
  }

  function bindBrush() {
    brushCanvas.addEventListener("pointerdown", event => {
      if (!brushMode) return;
      isDrawing = true;
      const point = getCanvasPoint(event);
      brushCtx.beginPath();
      brushCtx.moveTo(point.x, point.y);
    });

    brushCanvas.addEventListener("pointermove", event => {
      if (!brushMode || !isDrawing) return;
      const point = getCanvasPoint(event);
      brushCtx.lineTo(point.x, point.y);
      brushCtx.strokeStyle = "#202414";
      brushCtx.lineWidth = 4;
      brushCtx.lineCap = "round";
      brushCtx.lineJoin = "round";
      brushCtx.stroke();
    });

    brushCanvas.addEventListener("pointerup", () => {
      if (!isDrawing) return;
      isDrawing = false;
      saveHistory();
    });

    brushCanvas.addEventListener("pointercancel", () => {
      isDrawing = false;
    });
  }

  function resizeBrushCanvas() {
    if (!canvas || !brushCanvas) return;
    const rect = canvas.getBoundingClientRect();
    const data = brushCanvas.toDataURL("image/png");
    brushCanvas.width = Math.round(rect.width * 2);
    brushCanvas.height = Math.round(rect.height * 2);
    brushCanvas.style.width = `${rect.width}px`;
    brushCanvas.style.height = `${rect.height}px`;
    brushCtx = brushCanvas.getContext("2d");
    brushCtx.scale(2, 2);

    if (data && data.length > 100) {
      const img = new Image();
      img.onload = () => brushCtx.drawImage(img, 0, 0, rect.width, rect.height);
      img.src = data;
    }
  }

  function getCanvasPoint(event) {
    const rect = brushCanvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  function setBackground(color) {
    currentBg = color;
    canvas.style.setProperty("--collage-bg", color);
    saveHistory();
  }

  function toggleBrushMode() {
    brushMode = !brushMode;
    canvas.classList.toggle("brush-mode", brushMode);
    selectItem(null);
  }

  function addImage(src) {
    brushMode = false;
    canvas.classList.remove("brush-mode");

    const item = createItem("image");
    const image = document.createElement("img");
    image.src = src;
    image.alt = "collage image";
    item.appendChild(image);
    addHandles(item);

    canvas.appendChild(item);
    finalizeNewItem(item);
  }

  function addText() {
    brushMode = false;
    canvas.classList.remove("brush-mode");

    const text = prompt("輸入文字", "My Pikmin postcard");
    if (!text) return;

    const item = createItem("text");
    const inner = document.createElement("div");
    inner.className = "collage-text-inner";
    inner.textContent = text;
    item.appendChild(inner);
    addHandles(item);

    canvas.appendChild(item);
    finalizeNewItem(item);
  }

  function createItem(type) {
    const item = document.createElement("div");
    item.className = `collage-item collage-${type}`;
    item.dataset.type = type;
    item.dataset.x = String(80 + Math.random() * 80);
    item.dataset.y = String(80 + Math.random() * 80);
    item.dataset.scale = "1";
    item.dataset.rotate = "0";
    item.dataset.crop = "none";
    item.style.zIndex = String(++zIndexCounter);

    item.addEventListener("pointerdown", startMove);
    item.addEventListener("click", event => {
      event.stopPropagation();
      selectItem(item);
    });

    return item;
  }

  function addHandles(item) {
    ["nw", "ne", "sw", "se"].forEach(pos => {
      const h = document.createElement("span");
      h.className = `resize-handle ${pos}`;
      h.dataset.handle = pos;
      h.addEventListener("pointerdown", startResize);
      item.appendChild(h);
    });

    const rotate = document.createElement("span");
    rotate.className = "rotate-handle";
    rotate.addEventListener("pointerdown", startRotate);
    item.appendChild(rotate);
  }

  function finalizeNewItem(item) {
    applyTransform(item);
    selectItem(item);
    updateEmptyHint();
    saveHistory();
  }

  function startMove(event) {
    if (event.target.classList.contains("resize-handle") || event.target.classList.contains("rotate-handle")) return;

    event.preventDefault();
    event.stopPropagation();

    const item = event.currentTarget;
    selectItem(item);

    activeInteraction = {
      type: "move",
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      startY: event.clientY,
      originalX: Number(item.dataset.x || "0"),
      originalY: Number(item.dataset.y || "0")
    };

    item.setPointerCapture(event.pointerId);
    item.addEventListener("pointermove", updateMove);
    item.addEventListener("pointerup", endInteraction);
    item.addEventListener("pointercancel", endInteraction);
  }

  function updateMove(event) {
    if (!activeInteraction || activeInteraction.pointerId !== event.pointerId) return;

    const dx = event.clientX - activeInteraction.startX;
    const dy = event.clientY - activeInteraction.startY;

    activeInteraction.item.dataset.x = String(activeInteraction.originalX + dx);
    activeInteraction.item.dataset.y = String(activeInteraction.originalY + dy);

    applyTransform(activeInteraction.item);
    updateToolbarPosition();
  }

  function startResize(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = event.currentTarget.closest(".collage-item");
    selectItem(item);

    activeInteraction = {
      type: "resize",
      pointerId: event.pointerId,
      item,
      startX: event.clientX,
      originalScale: Number(item.dataset.scale || "1")
    };

    item.setPointerCapture(event.pointerId);
    item.addEventListener("pointermove", updateResize);
    item.addEventListener("pointerup", endInteraction);
    item.addEventListener("pointercancel", endInteraction);
  }

  function updateResize(event) {
    if (!activeInteraction || activeInteraction.pointerId !== event.pointerId) return;

    const dx = event.clientX - activeInteraction.startX;
    const next = Math.max(0.35, Math.min(2.4, activeInteraction.originalScale + dx / 260));

    activeInteraction.item.dataset.scale = String(next);
    applyTransform(activeInteraction.item);
    updateToolbarPosition();
  }

  function startRotate(event) {
    event.preventDefault();
    event.stopPropagation();

    const item = event.currentTarget.closest(".collage-item");
    selectItem(item);

    const rect = item.getBoundingClientRect();

    activeInteraction = {
      type: "rotate",
      pointerId: event.pointerId,
      item,
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2
    };

    item.setPointerCapture(event.pointerId);
    item.addEventListener("pointermove", updateRotate);
    item.addEventListener("pointerup", endInteraction);
    item.addEventListener("pointercancel", endInteraction);
  }

  function updateRotate(event) {
    if (!activeInteraction || activeInteraction.pointerId !== event.pointerId) return;

    const angle = Math.atan2(event.clientY - activeInteraction.centerY, event.clientX - activeInteraction.centerX);
    const degrees = angle * 180 / Math.PI + 90;

    activeInteraction.item.dataset.rotate = String(degrees);
    applyTransform(activeInteraction.item);
    updateToolbarPosition();
  }

  function endInteraction(event) {
    if (!activeInteraction || activeInteraction.pointerId !== event.pointerId) return;

    const item = activeInteraction.item;

    try {
      item.releasePointerCapture(event.pointerId);
    } catch {}

    item.removeEventListener("pointermove", updateMove);
    item.removeEventListener("pointermove", updateResize);
    item.removeEventListener("pointermove", updateRotate);
    item.removeEventListener("pointerup", endInteraction);
    item.removeEventListener("pointercancel", endInteraction);

    activeInteraction = null;
    saveHistory();
  }

  function applyTransform(item) {
    const x = Number(item.dataset.x || "0");
    const y = Number(item.dataset.y || "0");
    const scale = Number(item.dataset.scale || "1");
    const rotate = Number(item.dataset.rotate || "0");

    item.style.left = `${x}px`;
    item.style.top = `${y}px`;
    item.style.transform = `scale(${scale}) rotate(${rotate}deg)`;

    const img = item.querySelector("img");
    if (img) {
      img.style.aspectRatio = item.dataset.crop === "square" ? "1 / 1" : "";
      img.style.objectFit = item.dataset.crop === "square" ? "cover" : "";
    }
  }

  function selectItem(item) {
    if (selectedItem) selectedItem.classList.remove("selected");
    selectedItem = item;

    if (selectedItem) {
      selectedItem.classList.add("selected");
      updateToolbarPosition();
      toolbar.classList.remove("hidden");
    } else {
      toolbar.classList.add("hidden");
    }
  }

  function updateToolbarPosition() {
    if (!selectedItem || !toolbar) return;

    const rect = selectedItem.getBoundingClientRect();
    toolbar.style.left = `${rect.left + rect.width / 2 - toolbar.offsetWidth / 2}px`;
    toolbar.style.top = `${rect.bottom + 12}px`;
  }

  function duplicateSelected() {
    if (!selectedItem) return;

    const clone = selectedItem.cloneNode(true);
    clone.dataset.x = String(Number(selectedItem.dataset.x || "0") + 24);
    clone.dataset.y = String(Number(selectedItem.dataset.y || "0") + 24);
    clone.style.zIndex = String(++zIndexCounter);

    clone.addEventListener("pointerdown", startMove);
    clone.addEventListener("click", event => {
      event.stopPropagation();
      selectItem(clone);
    });

    clone.querySelectorAll(".resize-handle").forEach(h => h.addEventListener("pointerdown", startResize));
    clone.querySelector(".rotate-handle")?.addEventListener("pointerdown", startRotate);

    canvas.appendChild(clone);
    applyTransform(clone);
    selectItem(clone);
    updateEmptyHint();
    saveHistory();
  }

  function deleteSelected() {
    if (!selectedItem) return;
    selectedItem.remove();
    selectedItem = null;
    toolbar.classList.add("hidden");
    updateEmptyHint();
    saveHistory();
  }

  function toggleCropSelected() {
    if (!selectedItem) return;
    selectedItem.dataset.crop = selectedItem.dataset.crop === "square" ? "none" : "square";
    applyTransform(selectedItem);
    saveHistory();
  }

  function bringForward() {
    if (!selectedItem) return;
    selectedItem.style.zIndex = String(++zIndexCounter);
    saveHistory();
  }

  function sendBackward() {
    if (!selectedItem) return;
    selectedItem.style.zIndex = "1";
    saveHistory();
  }

  function clearCanvas() {
    if (!confirm("確定要清空拼貼畫布嗎？")) return;
    canvas.querySelectorAll(".collage-item").forEach(item => item.remove());
    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    selectItem(null);
    updateEmptyHint();
    saveHistory();
  }

  function updateEmptyHint() {
    const hint = canvas.querySelector(".collage-empty-hint");
    const hasItems = canvas.querySelectorAll(".collage-item").length > 0;
    if (hint) hint.classList.toggle("hidden", hasItems);
  }

  function serialize() {
    return {
      bg: currentBg,
      brush: brushCanvas.toDataURL("image/png"),
      items: Array.from(canvas.querySelectorAll(".collage-item")).map(item => ({
        type: item.dataset.type,
        x: item.dataset.x,
        y: item.dataset.y,
        scale: item.dataset.scale,
        rotate: item.dataset.rotate,
        crop: item.dataset.crop,
        z: item.style.zIndex,
        src: item.querySelector("img")?.src || "",
        text: item.querySelector(".collage-text-inner")?.textContent || ""
      }))
    };
  }

  function restore(state) {
    if (!state) return;

    currentBg = state.bg || "#fffef8";
    canvas.style.setProperty("--collage-bg", currentBg);
    canvas.querySelectorAll(".collage-item").forEach(item => item.remove());

    (state.items || []).forEach(data => {
      const item = createItem(data.type || "image");
      item.dataset.x = data.x || "80";
      item.dataset.y = data.y || "80";
      item.dataset.scale = data.scale || "1";
      item.dataset.rotate = data.rotate || "0";
      item.dataset.crop = data.crop || "none";
      item.style.zIndex = data.z || "1";

      if (data.type === "text") {
        const inner = document.createElement("div");
        inner.className = "collage-text-inner";
        inner.textContent = data.text || "文字";
        item.appendChild(inner);
      } else {
        const img = document.createElement("img");
        img.src = data.src;
        img.alt = "collage image";
        item.appendChild(img);
      }

      addHandles(item);
      canvas.appendChild(item);
      applyTransform(item);
    });

    brushCtx.clearRect(0, 0, brushCanvas.width, brushCanvas.height);
    if (state.brush) {
      const img = new Image();
      img.onload = () => {
        const rect = canvas.getBoundingClientRect();
        brushCtx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = state.brush;
    }

    selectItem(null);
    updateEmptyHint();
  }

  function saveHistory() {
    const state = serialize();
    history = history.slice(0, historyIndex + 1);
    history.push(JSON.stringify(state));
    historyIndex = history.length - 1;
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex -= 1;
    restore(JSON.parse(history[historyIndex]));
  }

  function redo() {
    if (historyIndex >= history.length - 1) return;
    historyIndex += 1;
    restore(JSON.parse(history[historyIndex]));
  }

  async function exportPng() {
    selectItem(null);

    const rect = canvas.getBoundingClientRect();
    const scale = 2;

    const output = document.createElement("canvas");
    output.width = Math.round(rect.width * scale);
    output.height = Math.round(rect.height * scale);

    const ctx = output.getContext("2d");

    drawBackground(ctx, output.width, output.height, scale);

    const sorted = Array.from(canvas.querySelectorAll(".collage-item"))
      .sort((a, b) => Number(a.style.zIndex || 0) - Number(b.style.zIndex || 0));

    for (const item of sorted) {
      await drawItem(ctx, item, scale);
    }

    await drawBrush(ctx, scale);

    const link = document.createElement("a");
    link.download = `pikmin-collage-${Date.now()}.png`;
    link.href = output.toDataURL("image/png");
    link.click();
  }

  function drawBackground(ctx, width, height, scale) {
    ctx.fillStyle = currentBg;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(110, 112, 99, 0.22)";
    const gap = 18 * scale;

    for (let x = gap; x < width; x += gap) {
      for (let y = gap; y < height; y += gap) {
        ctx.beginPath();
        ctx.arc(x, y, 1.2 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawItem(ctx, item, outputScale) {
    return new Promise(resolve => {
      const x = Number(item.dataset.x || "0") * outputScale;
      const y = Number(item.dataset.y || "0") * outputScale;
      const scale = Number(item.dataset.scale || "1");
      const rotate = Number(item.dataset.rotate || "0") * Math.PI / 180;
      const width = item.offsetWidth * outputScale;
      const height = item.offsetHeight * outputScale;

      ctx.save();
      ctx.translate(x + width / 2, y + height / 2);
      ctx.rotate(rotate);
      ctx.scale(scale, scale);

      if (item.dataset.type === "text") {
        drawTextItem(ctx, item, -width / 2, -height / 2, width, height);
        ctx.restore();
        resolve();
        return;
      }

      const imgEl = item.querySelector("img");
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        roundImage(ctx, img, -width / 2, -height / 2, width, height, 16 * outputScale);
        ctx.restore();
        resolve();
      };
      img.onerror = () => {
        ctx.restore();
        resolve();
      };
      img.src = imgEl.src;
    });
  }

  function drawTextItem(ctx, item, x, y, width, height) {
    const text = item.querySelector(".collage-text-inner")?.textContent || "";
    ctx.fillStyle = "rgba(255,255,255,0.86)";
    roundedRect(ctx, x, y, width, height, 16);
    ctx.fill();

    ctx.fillStyle = "#202414";
    ctx.font = `${18 * 2}px sans-serif`;
    ctx.fillText(text, x + 16, y + Math.min(height - 16, 44));
  }

  function drawBrush(ctx, outputScale) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, brushCanvas.width / 2 * outputScale, brushCanvas.height / 2 * outputScale);
        resolve();
      };
      img.onerror = resolve;
      img.src = brushCanvas.toDataURL("image/png");
    });
  }

  function roundImage(ctx, image, x, y, width, height, radius) {
    ctx.save();
    roundedRect(ctx, x, y, width, height, radius);
    ctx.clip();
    ctx.drawImage(image, x, y, width, height);
    ctx.restore();
  }

  function roundedRect(ctx, x, y, width, height, radius) {
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
  }

  return {
    init,
    refreshLibrary
  };
})();
