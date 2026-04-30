// simplified final render (integrated)
function isMobileView(){
  return window.matchMedia("(max-width:600px)").matches;
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
    const card = document.createElement("article");
    card.className = "postcard-card";

    const photo = document.createElement("div");
    photo.className = "postcard-photo";

    const img = document.createElement("img");
    img.src = item.image;

    img.onload = () => {
      if (img.naturalWidth / img.naturalHeight > 1.2) {
        img.classList.add("landscape");
      }
    };

    photo.appendChild(img);

    const hover = document.createElement("div");
    hover.className = "postcard-hover-actions";

    const map = document.createElement("button");
    map.className = "float-btn map-btn";
    map.textContent = "📍";
    map.onclick = e => {
      e.stopPropagation();
      window.open("https://www.google.com/maps?q=" + item.locationText);
    };

    const like = document.createElement("button");
    like.className = "float-btn like-btn";
    like.textContent = "❤️";
    like.onclick = e => {
      e.stopPropagation();
      onLikeClick(item.id);
    };

    const edit = document.createElement("button");
    edit.className = "float-btn edit-btn";
    edit.textContent = "編輯";
    edit.onclick = e => {
      e.stopPropagation();
      onEditClick(item);
    };

    const more = document.createElement("button");
    more.className = "float-btn more-btn";
    more.textContent = "⋯";

    hover.append(map, like, edit, more);
    photo.appendChild(hover);

    const info = document.createElement("div");
    info.className = "postcard-info";

    const title = document.createElement("div");
    title.className = "postcard-title";
    title.textContent = isMobileView()
      ? item.locationText
      : "No." + item.id;

    info.appendChild(title);

    card.append(photo, info);
    grid.appendChild(card);
  });
}
