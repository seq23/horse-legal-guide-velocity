function writeCanonicalTag(url) {
  return `<link rel="canonical" href="${url}">`;
}

module.exports = { writeCanonicalTag };
