
(function(){
  // Export log rules for centralized compilation in mathToLatex.js
  const LOG_RULES = [
    ["\\ln(%)", "\\ln($1)"],
    ["\\ln (%)", "\\ln($1)"],
    ["\\ln(%", "\\ln($1)"],
    ["\\ln %", "\\ln($1)"],
    ["\\ln", "\\ln(x)"],
    ["\\log(%,%)", "\\log_{$1}($2)"],
    ["\\log_%(%)", "\\log_{$1}($2)"],
    ["\\log_{%}", ["\\log_{$1}(x)", "\\log($1)"]],
    ["\\log_%", ["\\log_{$1}(x)", "\\log($1)"]],
    ["\\log(%)", ["\\log($1)", "\\log_{10}($1)"]],
    ["\\log (%)", ["\\log($1)", "\\log_{10}($1)"]],
    ["\\log(%", ["\\log($1)", "\\log_{10}($1)"]],
    ["\\log%(%)", "\\log_{$1}($2)"],
    ["\\log%(%", "\\log_{$1}($2)"],
    ["\\log %", ["\\log($1)", "\\log_{10}($1)"]],
    ["\\log", ["\\log(x)", "\\log_{10}(x)", "\\ln(x)"]],
    ["ln(%)", "\\ln($1)"],
    ["ln (%)", "\\ln($1)"],
    ["ln", "\\ln(x)"],
    ["ln(%", "\\ln($1)"],
    ["ln%", ["\\ln(x)", "\\ln($1)"]],
    ["ln %", ["\\ln(x)", "\\ln($1)"]],
    ["loge %", "\\ln($1)"],
    ["loge(%)", "\\ln($1)"],
    ["log_e(%)", "\\ln($1)"],
    ["log e(%)", "\\ln($1)"],
    ["lg(%)", "\\log_{10}($1)"],
    ["lg (%)", "\\log_{10}($1)"],
    ["lg(%", "\\log_{10}($1)"],
    ["lg (%", "\\log_{10}($1)"],
    ["lg%", "\\log_{10}($1)"],
    ["lg %", "\\log_{10}($1)"],
    ["lg", "\\log_{10}(x)"],
    ["log(%,%)", "\\log_{$1}($2)"],
    ["log_%(%)", "\\log_{$1}($2)"],
    ["log(%)", "\\log($1)"],
    ["log (%)", "\\log($1)"],
    ["log%(%)", "\\log_{$1}($2)"],
    ["log%(%", "\\log_{$1}($2)"],
    ["log_%", "\\log_{$1}"],
    ["log%", "\\log_{$1}"],
    ["log", ["\\log(x)", "\\log_{10}(x)", "\\ln(x)"]],
    ["log% %", "\\log_{$1}($2)"],
    ["log %", "\\log($1)"],
    ["ln %", "\\ln($1)"],
    ["lg %", "\\log_{10}($1)"]
  ];

  if (typeof globalThis !== 'undefined'){
    globalThis.LOG_RULES = LOG_RULES;
  }
  if (typeof module !== 'undefined' && module.exports){
    module.exports = { LOG_RULES };
  }
})();
