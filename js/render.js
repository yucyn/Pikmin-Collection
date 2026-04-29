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

  return list
    .map((item, originalIndex) => ({ ...item, originalIndex }))
    .filter(item => {
      const itemCategory = item.category || "全球";
      const text = [item.locationText, itemCategory, item.note || ""].join(" ").toLowerCase();
      return (!query || text.includes(query)) && (!category || itemCategory === category);
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

function renderPostcards({ grid, emptyState, onCardClick, onLikeClick, onCopyClick, onDeleteClick, onShareClick, filters }) {
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", list.length > 0);

  list.forEach(item => {
    const titleNumber = String(item.originalIndex + 1).padStart(3, "0");
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);

    const card = createEl("article", "postcard-card");
    card.dataset.id = item.id;

    const photo = createEl("div", "postcard-photo");

    const image = createEl("img");
    image.src = item.image;
    image.alt = "Pikmin postcard image";
    photo.appendChild(image);

    const hoverActions = createEl("div", "postcard-hover-actions");

    const mapButton = createEl("button", "float-btn map-btn", "Map");
    mapButton.type = "button";
    mapButton.addEventListener("click", event => {
      event.stopPropagation();
      window.open(createGoogleMapUrl(item.lat, item.lng), "_blank");
    });
    hoverActions.appendChild(mapButton);

    const copyButton = createEl("button", "float-btn copy-btn", "📍");
    copyButton.type = "button";
    copyButton.addEventListener("click", event => {
      event.stopPropagation();
      onCopyClick(item.locationText);
    });
    hoverActions.appendChild(copyButton);

    photo.appendChild(hoverActions);

    photo.addEventListener("click", () => onCardClick(item));
    card.appendChild(photo);

    const info = createEl("div", "postcard-info");

    const titleRow = createEl("div", "postcard-title-row");

    const title = createEl("div", "postcard-title", `No.${titleNumber}`);
    titleRow.appendChild(title);

    const likeButton = createEl(
      "button",
      `postcard-want ${liked ? "active" : ""}`,
      `${liked ? "❤️" : "♡"} ${formatLikeCount(item.likeCount)}`
    );
    likeButton.type = "button";
    likeButton.addEventListener("click", event => {
      event.stopPropagation();
      onLikeClick(item.id);
    });
    titleRow.appendChild(likeButton);

    info.appendChild(titleRow);

    const location = createEl("div", "postcard-coords", item.locationText || "");
    info.appendChild(location);

    const country = createEl("span", "postcard-country", category);
    info.appendChild(country);

    const bottomActions = createEl("div", "v28-card-secondary-actions");

    const shareButton = createEl("button", "v28-soft-action", "分享");
    shareButton.type = "button";
    shareButton.addEventListener("click", event => {
      event.stopPropagation();
      onShareClick(item.id);
    });
    bottomActions.appendChild(shareButton);

    if (canDelete) {
      const deleteButton = createEl("button", "v28-soft-action danger", "刪除");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        onDeleteClick(item.id);
      });
      bottomActions.appendChild(deleteButton);
    }

    info.appendChild(bottomActions);
    card.appendChild(info);

    grid.appendChild(card);
  });
}

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
