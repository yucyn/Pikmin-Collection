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

function renderPostcards({ grid, emptyState, onCardClick, onLikeClick, onCopyClick, onDeleteClick, onShareClick, filters }) {
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", list.length > 0);

  list.forEach(function (item) {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.id = item.id;

    const titleNumber = String(item.originalIndex + 1).padStart(3, "0");
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);

    card.innerHTML = `
      <img src="${item.image}" alt="Pikmin postcard image">
      <div class="card-title">No.${titleNumber}</div>
      <div class="card-location">${item.locationText}</div>

      <div class="card-meta-row">
        <span class="category-badge">${category}</span>
        <button class="like-button ${liked ? "liked" : ""}" type="button">
          ${liked ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}
        </button>
      </div>

      const canDelete = isOwnedByCurrentUser(item);

card.innerHTML = `
  ...
  <div class="card-actions">
    <button class="copy-button" type="button">複製座標</button>
    <button class="share-button small-share-button" type="button">分享</button>
    ${canDelete ? `<button class="delete-button" type="button">刪除</button>` : ""}
  </div>
  ...
`;

      <a
        class="map-btn"
        href="${createGoogleMapUrl(item.lat, item.lng)}"
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Google Map
      </a>
    `;

    card.addEventListener("click", function (event) {
      if (event.target.closest(".like-button")) {
        event.stopPropagation();
        onLikeClick(item.id);
        return;
      }

      if (event.target.closest(".copy-button")) {
        event.stopPropagation();
        onCopyClick(item.locationText);
        return;
      }

      if (event.target.closest(".share-button")) {
        event.stopPropagation();
        onShareClick(item.id);
        return;
      }

      if (event.target.closest(".delete-button")) {
        event.stopPropagation();
        onDeleteClick(item.id);
        return;
      }

      if (event.target.closest("a")) return;
      onCardClick(item);
    });

    grid.appendChild(card);
  });
}

function renderMapList({ mapList, onSelect, filters }) {
  const list = getFilteredPostcards(filters);

  mapList.innerHTML = "";

  list.forEach(function (item) {
    const button = document.createElement("button");
    button.className = "map-list-item";
    button.type = "button";
    button.dataset.id = item.id;

    const category = item.category || "全球";

    button.innerHTML = `
      <img src="${item.image}" alt="postcard thumbnail">
      <span>
        <strong>No.${String(item.originalIndex + 1).padStart(3, "0")}</strong>
        <span>${item.locationText}</span>
        <span class="map-list-meta">
          <span class="category-badge">${category}</span>
          <span>${isLikedByCurrentUser(item) ? "❤️" : "🤍"} ${formatLikeCount(item.likeCount)}</span>
        </span>
      </span>
    `;

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
