function formatLikeCount(count) {
  const number = Number(count || 0);

  if (number >= 10000) {
    return `${(number / 10000).toFixed(1).replace(".0", "")} 萬`;
  }

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
      const text = [
        item.locationText,
        itemCategory,
        item.note || ""
      ].join(" ").toLowerCase();

      const matchesQuery = !query || text.includes(query);
      const matchesCategory = !category || itemCategory === category;

      return matchesQuery && matchesCategory;
    });
}

function getCategories() {
  const popularCountries = [
    "全球",
    "台灣",
    "日本",
    "香港",
    "埃及",
    "希臘",
    "哥倫比亞",
    "紐西蘭",
    "阿根廷",
    "杜拜",
    "布拉格",
    "斯洛維尼亞",
    "英國",
    "義大利",
    "冰島",
    "德國",
    "土耳其",
    "美國",
    "韓國"
  ];

  const existingCategories = getPostcards()
    .map(item => item.category || "全球")
    .filter(Boolean);

  return Array.from(new Set([...popularCountries, ...existingCategories]));
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

  if (className) {
    el.className = className;
  }

  if (textContent !== undefined) {
    el.textContent = textContent;
  }

  return el;
}

function createPostcardCard({ item, titleNumber, category, liked, canDelete, onCardClick, onLikeClick, onCopyClick, onDeleteClick, onShareClick }) {
  const card = createEl("article", "card");
  card.dataset.id = item.id;

  const image = createEl("img");
  image.src = item.image;
  image.alt = "Pikmin postcard image";
  card.appendChild(image);

  const title = createEl("div", "card-title", `No.${titleNumber}`);
  card.appendChild(title);

  const location = createEl("div", "card-location", item.locationText || "");
  card.appendChild(location);

  const metaRow = createEl("div", "card-meta-row");

  const categoryBadge = createEl("span", "category-badge", category);
  metaRow.appendChild(categoryBadge);

  const likeButton = createEl("button", `like-button ${liked ? "liked" : ""}`, `${liked ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`);
  likeButton.type = "button";
  likeButton.addEventListener("click", function (event) {
    event.stopPropagation();
    onLikeClick(item.id);
  });
  metaRow.appendChild(likeButton);

  card.appendChild(metaRow);

  const actions = createEl("div", "card-actions");

  const copyButton = createEl("button", "copy-button", "複製座標");
  copyButton.type = "button";
  copyButton.addEventListener("click", function (event) {
    event.stopPropagation();
    onCopyClick(item.locationText);
  });
  actions.appendChild(copyButton);

  const shareButton = createEl("button", "share-button small-share-button", "分享");
  shareButton.type = "button";
  shareButton.addEventListener("click", function (event) {
    event.stopPropagation();
    onShareClick(item.id);
  });
  actions.appendChild(shareButton);

  if (canDelete) {
    const deleteButton = createEl("button", "delete-button", "刪除");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", function (event) {
      event.stopPropagation();
      onDeleteClick(item.id);
    });
    actions.appendChild(deleteButton);
  }

  card.appendChild(actions);

  const mapLink = createEl("a", "map-btn", "Open Google Map");
  mapLink.href = createGoogleMapUrl(item.lat, item.lng);
  mapLink.target = "_blank";
  mapLink.rel = "noopener noreferrer";
  mapLink.addEventListener("click", function (event) {
    event.stopPropagation();
  });
  card.appendChild(mapLink);

  card.addEventListener("click", function () {
    onCardClick(item);
  });

  return card;
}

function renderPostcards({ grid, emptyState, onCardClick, onLikeClick, onCopyClick, onDeleteClick, onShareClick, filters }) {
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", list.length > 0);

  list.forEach(function (item) {
    const titleNumber = String(item.originalIndex + 1).padStart(3, "0");
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);

    const card = createPostcardCard({
      item,
      titleNumber,
      category,
      liked,
      canDelete,
      onCardClick,
      onLikeClick,
      onCopyClick,
      onDeleteClick,
      onShareClick
    });

    grid.appendChild(card);
  });
}

function renderMapList({ mapList, onSelect, filters }) {
  const list = getFilteredPostcards(filters);

  mapList.innerHTML = "";

  list.forEach(function (item) {
    const button = createEl("button", "map-list-item");
    button.type = "button";
    button.dataset.id = item.id;

    const thumbnail = createEl("img");
    thumbnail.src = item.image;
    thumbnail.alt = "postcard thumbnail";
    button.appendChild(thumbnail);

    const content = createEl("span");

    const title = createEl("strong", "", `No.${String(item.originalIndex + 1).padStart(3, "0")}`);
    content.appendChild(title);

    const location = createEl("span", "", item.locationText || "");
    content.appendChild(location);

    const meta = createEl("span", "map-list-meta");

    const categoryBadge = createEl("span", "category-badge", item.category || "全球");
    meta.appendChild(categoryBadge);

    const likeText = createEl("span", "", `${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}`);
    meta.appendChild(likeText);

    content.appendChild(meta);
    button.appendChild(content);

    button.addEventListener("click", function () {
      onSelect(item);
    });

    mapList.appendChild(button);
  });
}

function setActiveMapItem(mapList, id) {
  Array.from(mapList.children).forEach(item => {
    item.classList.toggle("active", String(item.dataset.id) === String(id));
  });
}
