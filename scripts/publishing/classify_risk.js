function classifyRisk(page) {
  return page.risk_level || 'high';
}

module.exports = { classifyRisk };
