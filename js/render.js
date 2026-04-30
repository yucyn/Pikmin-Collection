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

/* ===== Pikmin Tag System ===== */

.tag{
  display:inline-flex;
  align-items:center;
  gap:6px;

  padding:3px 10px;
  border-radius:999px;

  background:rgba(255,255,255,0.85);
  border:1px solid rgba(60,70,50,0.12);
  box-shadow:0 2px 6px rgba(0,0,0,0.04);

  font-size:12px;
  font-weight:700;
  color:#2f2f2f;
}

/* 花 */
.tag-花::before{
  content:"✿";
  color:#b98390;
}

/* 蘑菇（最終版） */
.tag-蘑菇{
  position:relative;
  padding-left:18px;
}

.tag-蘑菇::before{
  content:"";
  position:absolute;
  left:6px;
  top:50%;
  transform:translateY(-65%);
  width:7.5px;
  height:5.5px;
  background:#8a6042;
  border-radius:9px 9px 4px 4px;
}

/* 👉 莖（你剛剛調整的） */
.tag-蘑菇::after{
  content:"";
  position:absolute;
  left:9px;
  top:50%;
  transform:translateY(-5%);
  width:2.3px;
  height:5.2px;
  background:#8a6042;
  border-radius:2px;
}

/* 🌈 隱藏 */
.tag-隱藏{
  color:transparent;
  background-image:linear-gradient(
    90deg,
    #00c2ff,
    #38d16a,
    #ffd93d,
    #ff7a18,
    #ff2d95,
    #6c5ce7
  );
  -webkit-background-clip:text;
  background-clip:text;
}

.tag-隱藏::before{
  content:"";
  width:6px;
  height:6px;
  border-radius:50%;
  background:linear-gradient(
    135deg,
    #00c2ff,
    #38d16a,
    #ffd93d,
    #ff7a18,
    #ff2d95,
    #6c5ce7
  );
}

function renderPostcards({
  grid,
  emptyState,
  onCardClick,
  onLikeClick,
  onCopyClick,
  onDeleteClick,
  onShareClick,
  filters
}) {
  const list = getFilteredPostcards(filters);

  grid.innerHTML = "";
  emptyState.classList.toggle("hidden", list.length > 0);

  list.forEach(item => {
    const titleNumber = String(item.originalIndex + 1).padStart(3, "0");
    const category = item.category || "全球";
    const liked = isLikedByCurrentUser(item);
    const canDelete = isOwnedByCurrentUser(item);
    const tag = item.tag || "";

    const card = createEl("article", "postcard-card");
    card.dataset.id = item.id;

   /* 圖片區 */
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

photo.appendChild(image);
    

    const hoverActions = createEl("div", "postcard-hover-actions");

    const mapButton = createEl("button", "float-btn map-btn", "Map");
    mapButton.type = "button";
    mapButton.addEventListener("click", event => {
      event.stopPropagation();
      window.open(createGoogleMapUrl(item.lat, item.lng), "_blank");
    });
    hoverActions.appendChild(mapButton);

    const moreButton = createEl("button", "float-btn more-btn", "⋯");
    moreButton.type = "button";
    moreButton.title = "更多操作";
    moreButton.addEventListener("click", event => {
      event.stopPropagation();
      if (canDelete) {
        onDeleteClick(item.id);
      }
      
    });
    hoverActions.appendChild(moreButton);

    photo.appendChild(hoverActions);
    photo.addEventListener("click", () => onCardClick(item));
    card.appendChild(photo);

    /* 資訊區 */
    const info = createEl("div", "postcard-info");

    const titleRow = createEl("div", "postcard-title-row");

   const titleText = isMobileView()
  ? formatCoords(item.locationText)
  : `No.${titleNumber}`;

const title = createEl("div", "postcard-title", titleText);

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

    const coords = createEl("div", "postcard-coords", item.locationText || "");
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

    const actions = createEl("div", "v30-card-actions");

    const copyButton = createEl("button", "v30-text-action", "複製");
    copyButton.type = "button";
    copyButton.addEventListener("click", event => {
      event.stopPropagation();
      onCopyClick(item.locationText);
    });
    actions.appendChild(copyButton);

    const shareButton = createEl("button", "v30-text-action", "分享");
    shareButton.type = "button";
    shareButton.addEventListener("click", event => {
      event.stopPropagation();
      onShareClick(item.id);
    });
    actions.appendChild(shareButton);

    if (canDelete) {
      const deleteButton = createEl("button", "v30-text-action danger", "刪除");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", event => {
        event.stopPropagation();
        onDeleteClick(item.id);
      });
      actions.appendChild(deleteButton);
    }

    info.appendChild(actions);
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
