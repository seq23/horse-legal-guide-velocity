const { collectFromProvider } = require('./_provider_adapter');
async function collect(source) {
  return collectFromProvider(source, 'INSTAGRAM_SIGNAL_PROVIDER_URL');
}
module.exports = { collect };
