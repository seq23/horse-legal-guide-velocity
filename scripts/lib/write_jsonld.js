const { toAbsoluteUrl } = require('./write_canonical_tag');

function writeJsonLd(type, headline, description, url) {
  const absoluteUrl = toAbsoluteUrl(url);
  if (type === 'faq') {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'url': absoluteUrl,
      'mainEntity': [{
        '@type': 'Question',
        'name': headline,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': description
        }
      }]
    });
  }
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    'headline': headline,
    'description': description,
    'url': absoluteUrl
  });
}

module.exports = { writeJsonLd };
