module.exports = function () {
  return /\sMSIE\s[6-9]\./.test(window.navigator.userAgent);
};
