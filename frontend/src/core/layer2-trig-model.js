// Auto-generated from layer2.csv by train_layer2_trig.mjs
export const trigModel = {
  "total": 161,
  "priors": {
    "trig_basic": 30,
    "trig_power": 10,
    "trig_argument": 27,
    "trig_inverse": 42,
    "trig_expression": 12,
    "trig_degree": 26,
    "trig_product": 12,
    "trig_ratio": 2
  },
  "inputTypeCounts": {
    "sinx": {
      "trig_basic": 6
    },
    "cosx": {
      "trig_basic": 3
    },
    "tanx": {
      "trig_basic": 2
    },
    "sin2": {
      "trig_basic": 4,
      "trig_power": 1
    },
    "sin^2": {
      "trig_power": 1
    },
    "sin2x": {
      "trig_argument": 6,
      "trig_power": 1
    },
    "sinx2": {
      "trig_power": 1,
      "trig_argument": 3
    },
    "cos3x": {
      "trig_argument": 1,
      "trig_power": 1
    },
    "cosx3": {
      "trig_power": 1
    },
    "tan4": {
      "trig_basic": 2
    },
    "sin-1x": {
      "trig_inverse": 4
    },
    "sin^-1x": {
      "trig_inverse": 2
    },
    "arcsinx": {
      "trig_inverse": 1
    },
    "sin-1": {
      "trig_inverse": 2
    },
    "sin^-1": {
      "trig_inverse": 1
    },
    "sinx-1": {
      "trig_inverse": 5,
      "trig_basic": 1,
      "trig_expression": 3
    },
    "cos-1x": {
      "trig_inverse": 4
    },
    "cos^-1x": {
      "trig_inverse": 2
    },
    "arccosx": {
      "trig_inverse": 1
    },
    "cos-1": {
      "trig_inverse": 2
    },
    "cos^-1": {
      "trig_inverse": 1
    },
    "cosx-1": {
      "trig_inverse": 4,
      "trig_expression": 2
    },
    "tan-1x": {
      "trig_inverse": 2
    },
    "tan^-1x": {
      "trig_inverse": 2
    },
    "arctanx": {
      "trig_inverse": 1
    },
    "tan-1": {
      "trig_inverse": 2
    },
    "tan^-1": {
      "trig_inverse": 1
    },
    "tanx-1": {
      "trig_inverse": 4
    },
    "sin(x+1)": {
      "trig_expression": 1
    },
    "sinx+1": {
      "trig_expression": 1
    },
    "cos2x+1": {
      "trig_expression": 1
    },
    "cos(2x+1)": {
      "trig_expression": 1
    },
    "sin30": {
      "trig_degree": 3
    },
    "cos60": {
      "trig_degree": 3
    },
    "tan45": {
      "trig_degree": 1
    },
    "sin30+cos60": {
      "trig_degree": 1
    },
    "sin45-cos30": {
      "trig_degree": 1
    },
    "sinx=1/2": {
      "trig_basic": 3
    },
    "cos2x=0": {
      "trig_argument": 1
    },
    "tanx=1": {
      "trig_basic": 1
    },
    "solvesin2x=1": {
      "trig_argument": 1
    },
    "findcosx=0": {
      "trig_basic": 1
    },
    "evaluatetan45": {
      "trig_degree": 1
    },
    "sinxsinx": {
      "trig_product": 1
    },
    "sin^2x": {
      "trig_power": 1
    },
    "(sinx)2": {
      "trig_power": 1
    },
    "sin(x)^2": {
      "trig_power": 1
    },
    "cos(x)^2": {
      "trig_power": 1
    },
    "sinxcosx": {
      "trig_product": 3
    },
    "2sinx": {
      "trig_product": 4
    },
    "3cosx": {
      "trig_product": 1
    },
    "sinx/2": {
      "trig_ratio": 1
    },
    "sin(x)/2": {
      "trig_ratio": 1
    },
    "sin(2x)": {
      "trig_argument": 1
    },
    "sin2(x)": {
      "trig_argument": 1
    },
    "sinx^2": {
      "trig_argument": 1
    },
    "sin(2)": {
      "trig_basic": 1
    },
    "sin(x)": {
      "trig_basic": 1
    },
    "sin(-1)x": {
      "trig_inverse": 1
    },
    "sin30°": {
      "trig_degree": 2
    },
    "sin-30": {
      "trig_degree": 2
    },
    "sin-30°": {
      "trig_degree": 1
    },
    "sin30.5": {
      "trig_degree": 2
    },
    "sinx+30": {
      "trig_degree": 2
    },
    "sin(x+30)": {
      "trig_degree": 1
    },
    "cos2x": {
      "trig_argument": 3
    },
    "cos(2x)": {
      "trig_argument": 1
    },
    "cos2": {
      "trig_basic": 2
    },
    "cos(2)": {
      "trig_basic": 1
    },
    "cosx2": {
      "trig_argument": 2
    },
    "cosx^2": {
      "trig_argument": 1
    },
    "cos60°": {
      "trig_degree": 1
    },
    "tan2x": {
      "trig_argument": 2
    },
    "tan(2x)": {
      "trig_argument": 1
    },
    "tan2": {
      "trig_basic": 2
    },
    "tanx2": {
      "trig_argument": 1
    },
    "tanx^2": {
      "trig_argument": 1
    },
    "tan-45": {
      "trig_degree": 2
    },
    "tan-45°": {
      "trig_degree": 1
    },
    "sin2x+cosx": {
      "trig_expression": 2
    },
    "sin(2x)+cosx": {
      "trig_expression": 1
    },
    "2sinx=1": {
      "trig_product": 2
    },
    "tan(x+30)=1": {
      "trig_degree": 1
    },
    "tanx+30=1": {
      "trig_degree": 1
    },
    "sin(x)cos(x)": {
      "trig_product": 1
    }
  }
};
