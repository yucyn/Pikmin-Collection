function formatCoords(coords){
  if(!coords) return "";
  const [lat, lng] = String(coords).split(",").map(n => parseFloat(n));

  if(Number.isNaN(lat) || Number.isNaN(lng)) {
    return coords;
  }

  return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

function isMobileView(){
  return window.matchMedia("(max-width:600px)").matches;
}

function formatLikeCount(count) {
  const number = Number(count || 0);
  if (number >= 10000) return `${(number / 10000).toFixed(1).replace(".0", "")} 萬`;
  return String(number);
}

function isLikedByCurrentUser(item) {
  const userId = getCurrentUserId();
  return Array.isArray(item.likedBy) && item.likedBy.includes(userId);
}

function getFilteredPostcards(filters = {}) {
  const list = getPostcards();
  const query = String(filters.query || "").trim().toLowerCase();
  const category = String(filters.category || "").trim();
  const tag = String(filters.tag || "").trim();

  return list
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter(item => {
      const itemCategory = item.category || "全球";
      const itemTag = item.tag || "";

      const text = [
        item.locationText || "",
        itemCategory,
        item.note || "",
        itemTag
      ].join(" ").toLowerCase();

      const matchQuery = !query || text.includes(query);
      const matchCategory = !category || itemCategory === category;
      const matchTag = !tag || itemTag === tag;

      return matchQuery && matchCategory && matchTag;
    });
}

function getCategories() {
  const popular = ["全球","台灣","日本","香港","埃及","希臘","哥倫比亞","紐西蘭","阿根廷","杜拜","布拉格","斯洛維尼亞","英國","義大利","冰島","德國","土耳其","美國","韓國"];
  const existing = getPostcards().map(item => item.category || "全球").filter(Boolean);
  return Array.from(new Set([...popular, ...existing]));
}

function renderCategoryFilter(categoryFilter, selectedValue = "") {
  const categories = getCategories();
  categoryFilter.innerHTML = "";

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category === "全球" ? "" : category;
    option.textContent = category;
    option.selected = category === "全球" ? selectedValue === "" : category === selectedValue;
    categoryFilter.appendChild(option);
  });
}

function createEl(tagName, className, textContent) {
  const el = document.createElement(tagName);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function getGoogleMapUrlFromItem(item) {
  if (typeof createGoogleMapUrl === "function" && item.lat !== undefined && item.lng !== undefined) {
    return createGoogleMapUrl(item.lat, item.lng);
  }
  const coords = String(item.locationText || "").trim();
  return `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
}

function clampPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

function renderPostcards({
  grid,
  emptyState,
  onCardClick,
  onLikeClick,
  onCopyClick,
  onDeleteClick,
  onShareClick,
  onEditClick,
  filters
}) {
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", list.length > 0);

  list.forEach(item => {
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);
    const tag = item.tag || "";

    const card = createEl("article", "postcard-card");
    card.dataset.id = item.id;

    const photo = createEl("div", "postcard-photo");

    const image = createEl("img");
    image.onload = () => {
      const ratio = image.naturalWidth / image.naturalHeight;
      if (ratio > 1.2) {
        image.classList.add("landscape");
      }
    };
    image.src = item.image;
    image.alt = "Pikmin postcard image";
    let focusX = clampPercent(item.imageFocusX);
    let focusY = clampPercent(item.imageFocusY);
    image.style.setProperty("object-position", `${focusX}% ${focusY}%`, "important");
    photo.appendChild(image);

    const hoverActions = createEl("div", "postcard-hover-actions");

    const likeButton = createEl(
      "button",
      `float-btn like-btn postcard-want ${liked ? "active" : ""}`,
      `${liked ? "❤️" : "♡"} ${formatLikeCount(item.likeCount)}`
    );
    likeButton.type = "button";
    likeButton.title = "收藏 / 取消收藏";
    likeButton.addEventListener("click", event => {
      event.stopPropagation();
      onLikeClick(item.id);
    });
    hoverActions.appendChild(likeButton);

    if (typeof onEditClick === "function") {
      const editButton = createEl("button", "float-btn edit-btn", "編輯");
      editButton.type = "button";
      editButton.title = "編輯明信片";
      editButton.addEventListener("click", event => {
        event.stopPropagation();
        onEditClick(item);
      });
      hoverActions.appendChild(editButton);
    }

    const moreButton = createEl("button", "float-btn more-btn", "⋯");
    moreButton.type = "button";
    moreButton.title = "更多操作";
    hoverActions.appendChild(moreButton);

    const moreMenu = createEl("div", "postcard-more-menu");

    const shareMenuButton = createEl("button", "postcard-menu-action", "分享");
    shareMenuButton.type = "button";
    shareMenuButton.addEventListener("click", event => {
      event.stopPropagation();
      onShareClick(item.id);
      moreMenu.classList.remove("show");
    });
    moreMenu.appendChild(shareMenuButton);

    if (canDelete) {
      const deleteMenuButton = createEl("button", "postcard-menu-action danger", "刪除");
      deleteMenuButton.type = "button";
      deleteMenuButton.addEventListener("click", event => {
        event.stopPropagation();
        onDeleteClick(item.id);
        moreMenu.classList.remove("show");
      });
      moreMenu.appendChild(deleteMenuButton);
    }

    moreButton.addEventListener("click", event => {
      event.stopPropagation();
      document.querySelectorAll(".postcard-more-menu.show").forEach(menu => {
        if (menu !== moreMenu) menu.classList.remove("show");
      });
      moreMenu.classList.toggle("show");
    });

    hoverActions.appendChild(moreMenu);
    photo.appendChild(hoverActions);
    photo.addEventListener("click", () => onCardClick(item));
    card.appendChild(photo);

    const info = createEl("div", "postcard-info");

    const coords = createEl("div", "postcard-coords", item.locationText || "");
    const coordText = String(item.locationText || "").trim();
    if (coordText.length >= 24) {
      coords.classList.add("coords-very-long");
    } else if (coordText.length >= 20) {
      coords.classList.add("coords-long");
    }
    coords.title = "點擊複製座標";
    coords.addEventListener("click", event => {
      event.stopPropagation();
      onCopyClick(item.locationText);
    });
    info.appendChild(coords);

    const taxonomy = createEl("div", "postcard-taxonomy");
    taxonomy.appendChild(createEl("span", "postcard-country", category));

    if (tag) {
      const tagEl = createEl("button", `postcard-tag tag-${tag}`, tag);
      tagEl.type = "button";
      tagEl.title = `篩選：${tag}`;
      tagEl.addEventListener("click", event => {
        event.stopPropagation();
        const tagButton = document.querySelector(`.tag-filter[data-tag="${tag}"]`);
        if (tagButton) tagButton.click();
      });
      taxonomy.appendChild(tagEl);
    }

    info.appendChild(taxonomy);

    
    card.appendChild(info);
    
    // 當滑鼠離開卡片時，自動關閉已開啟的更多選單
    card.addEventListener("mouseleave", () => {
      moreMenu.classList.remove("show");
    });

    grid.appendChild(card);
  });
}

document.addEventListener("click", event => {
  if (!event.target.closest(".more-btn") && !event.target.closest(".postcard-more-menu")) {
    document.querySelectorAll(".postcard-more-menu.show").forEach(menu => {
      menu.classList.remove("show");
    });
  }
});

function renderMapList({ mapList, onSelect, filters }) {
  const list = getFilteredPostcards(filters);
  mapList.innerHTML = "";

  list.forEach(item => {
    const button = createEl("button", "map-list-item");
    button.type = "button";
    button.dataset.id = item.id;

    const thumbnail = createEl("img");
    thumbnail.src = item.image;
    thumbnail.alt = "postcard thumbnail";
    button.appendChild(thumbnail);

    const content = createEl("span");
    content.appendChild(createEl("strong", "", `No.${String(item.originalIndex + 1).padStart(3, "0")}`));
    content.appendChild(createEl("span", "", item.locationText || ""));

    const meta = createEl("span", "map-list-meta");
    meta.appendChild(createEl("span", "category-badge", item.category || "全球"));
    meta.appendChild(createEl("span", "", `${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`));
    content.appendChild(meta);

    button.appendChild(content);
    button.addEventListener("click", () => onSelect(item));
    mapList.appendChild(button);
  });
}

function setActiveMapItem(mapList, id) {
  Array.from(mapList.children).forEach(item => {
    item.classList.toggle("active", String(item.dataset.id) === String(id));
  });
}
