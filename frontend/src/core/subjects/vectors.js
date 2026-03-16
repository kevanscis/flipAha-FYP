
(function(){
  // Export vector rules for centralized compilation in mathToLatex.js
  const VECTOR_RULES = [
    ["vec(%)", "\\overrightarrow{$1}"],
    ["vec (%)", "\\overrightarrow{$1}"],
    ["Vec(%)", "\\overrightarrow{$1}"],
    ["vec %", "\\overrightarrow{$1}"],
    ["vec%", "\\overrightarrow{$1}"],
    ["vector(%)", "\\overrightarrow{$1}"],
    ["Vector(%)", "\\overrightarrow{$1}"],
    ["Vector %", "\\overrightarrow{$1}"],
    ["%hat", "\\hat{$1}"],
    ["% hat", "\\hat{$1}"],
    ["hat(%)", "\\hat{$1}"],
    ["hat (%)", "\\hat{$1}"],
    ["hat %", "\\hat{$1}"],
    ["hat%", "\\hat{$1}"],
    ["hat", ["\\hat{a}", "\\hat{v}", "\\hat{\\imath}", "\\hat{\\jmath}"]],
    ["%bar", "\\bar{$1}"],
    ["% bar", "\\bar{$1}"],
    ["bar(%)", "\\bar{$1}"],
    ["bar (%)", "\\bar{$1}"],
    ["bar %", "\\bar{$1}"],
    ["bar%", "\\bar{$1}"],
    ["bar", ["\\bar{x}", "\\bar{z}", "\\bar{active}"]]
  ];

  if (typeof globalThis !== 'undefined'){
    globalThis.VECTOR_RULES = VECTOR_RULES;
  }
  if (typeof module !== 'undefined' && module.exports){
    module.exports = { VECTOR_RULES };
  }
})();
