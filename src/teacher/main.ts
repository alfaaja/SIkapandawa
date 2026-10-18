// Preserve old bookmarks while keeping one monitoring entrance.
const target = new URL('/form/', window.location.origin);
target.search = window.location.search;
window.location.replace(target.href);
