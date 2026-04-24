function writeJsonLd(type, headline, description, url) {
  if (type === 'faq') {
    return JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
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
    'url': url
  });
}

module.exports = { writeJsonLd };
