(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  /**
   * Oráculo de referencia INDEPENDIENTE del motor interno (fullAdder / rippleCarryAdder8).
   * Utiliza aritmética entera nativa de JavaScript en 8 bits para verificar la ALU.
   */
  function independentOracle(aInt, bInt, opcode) {
    var a = aInt & 0xff;
    var b = bInt & 0xff;
    var signedA = a >= 128 ? a - 256 : a;
    var signedB = b >= 128 ? b - 256 : b;

    var res = 0;
    var C = 0;
    var V = 0;

    if (opcode === '000') {
      var sum = a + b;
      res = sum & 0xff;
      C = sum > 255 ? 1 : 0;
      var signedSum = signedA + signedB;
      V = (signedSum < -128 || signedSum > 127) ? 1 : 0;
    } else if (opcode === '001') {
      res = (a - b) & 0xff;
      // Convención de préstamo: C = 1 cuando A < B sin signo
      C = a < b ? 1 : 0;
      var signedDiff = signedA - signedB;
      V = (signedDiff < -128 || signedDiff > 127) ? 1 : 0;
    } else if (opcode === '010') {
      res = (a & b) & 0xff;
      C = 0;
      V = 0;
    } else if (opcode === '011') {
      res = (a | b) & 0xff;
      C = 0;
      V = 0;
    } else {
      return { isReserved: true };
    }

    var Z = res === 0 ? 1 : 0;
    var N = (res & 0x80) !== 0 ? 1 : 0;

    return {
      isReserved: false,
      unsigned: res,
      Z: Z,
      C: C,
      N: N,
      V: V
    };
  }

  /**
   * 14 casos de prueba unitarios y límite independientes.
   */
  var TEST_CASES = [
    {
      id: 'TC-01',
      name: 'Suma básica sin acarreo ni desbordamiento',
      category: 'ADD (000)',
      run: function () {
        var r = ALULab.ALU.execute('00001101', '00000111', '000'); // 13 + 7 = 20
        var exp = independentOracle(13, 7, '000');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-02',
      name: 'Suma con Carry de salida (200 + 100 = 300 -> 44)',
      category: 'ADD / Carry',
      run: function () {
        var r = ALULab.ALU.execute(200, 100, '000');
        var exp = independentOracle(200, 100, '000');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-03',
      name: 'Suma con Overflow positivo (127 + 1 = -128)',
      category: 'ADD / Overflow',
      run: function () {
        var r = ALULab.ALU.execute('01111111', '00000001', '000');
        var exp = independentOracle(127, 1, '000');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-04',
      name: 'Suma con Overflow negativo (-128 + -1 = +127)',
      category: 'ADD / Overflow',
      run: function () {
        var r = ALULab.ALU.execute(-128, -1, '000');
        var exp = independentOracle(128, 255, '000');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-05',
      name: 'Suma que activa bandera Zero y Carry (255 + 1 = 0)',
      category: 'ADD / Zero + Carry',
      run: function () {
        var r = ALULab.ALU.execute('11111111', '00000001', '000');
        var exp = independentOracle(255, 1, '000');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-06',
      name: 'Resta normal sin préstamo (45 - 15 = 30)',
      category: 'SUB (001)',
      run: function () {
        var r = ALULab.ALU.execute(45, 15, '001');
        var exp = independentOracle(45, 15, '001');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-07',
      name: 'Resta con Préstamo (Borrow C=1) y Negative N=1 (15 - 25 = -10)',
      category: 'SUB / Borrow',
      run: function () {
        var r = ALULab.ALU.execute(15, 25, '001');
        var exp = independentOracle(15, 25, '001');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-08',
      name: 'Resta igual a cero (42 - 42 = 0, Z=1, C=0)',
      category: 'SUB / Zero',
      run: function () {
        var r = ALULab.ALU.execute(42, 42, '001');
        var exp = independentOracle(42, 42, '001');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-09',
      name: 'Resta con Overflow con signo (-128 - 1 = +127)',
      category: 'SUB / Overflow',
      run: function () {
        var r = ALULab.ALU.execute(-128, 1, '001');
        var exp = independentOracle(128, 1, '001');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-10',
      name: 'Operación lógica AND con máscara (C=0, V=0)',
      category: 'AND (010)',
      run: function () {
        var r = ALULab.ALU.execute('10110110', '00001111', '010');
        var exp = independentOracle(0xb6, 0x0f, '010');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-11',
      name: 'Operación lógica OR de activación de bits (C=0, V=0)',
      category: 'OR (011)',
      run: function () {
        var r = ALULab.ALU.execute('10100000', '00000101', '011');
        var exp = independentOracle(0xa0, 0x05, '011');
        return verifyExecution(r, exp);
      }
    },
    {
      id: 'TC-12',
      name: 'Complemento a dos directo (NOT(B) + 1 para B = 00000101)',
      category: 'Complemento a 2',
      run: function () {
        var bits = ALULab.Binary.stringToBits('00000101');
        var tc = ALULab.Binary.computeTwosComplement(bits);
        var tcStr = ALULab.Binary.bitsToString(tc.twosComplement);
        var passed = tcStr === '11111011' && ALULab.Binary.bitsToSigned(tc.twosComplement) === -5;
        return {
          passed: passed,
          obtained: tcStr + ' (' + ALULab.Binary.bitsToSigned(tc.twosComplement) + ')',
          expected: '11111011 (-5)'
        };
      }
    },
    {
      id: 'TC-13',
      name: 'Validación estricta de entradas inválidas y códigos reservados',
      category: 'Validación / Control',
      run: function () {
        var badBin1 = ALULab.Binary.validateBinary8('10102');
        var badBin2 = ALULab.Binary.validateBinary8('1010');
        var badDec1 = ALULab.Binary.validateDecimal8(256, 'unsigned');
        var badDec2 = ALULab.Binary.validateDecimal8(-129, 'signed');
        var resOp = ALULab.ALU.execute('00000001', '00000001', '101');
        var passed = !badBin1.valid && !badBin2.valid && !badDec1.valid && !badDec2.valid && resOp.ok && resOp.isReserved === true;
        return {
          passed: passed,
          obtained: 'Rechazadas=4, Código 101 reservado=' + (resOp.isReserved ? 'Sí' : 'No'),
          expected: 'Rechazadas=4, Código 101 reservado=Sí'
        };
      }
    },
    {
      id: 'TC-14',
      name: 'Ejecución paso a paso sincronizada con la traza real',
      category: 'Simulación paso a paso',
      run: function () {
        var exec = ALULab.ALU.execute('00010100', '00001010', '001'); // 20 - 10 = 10
        var hasFiveSteps = exec.ok && exec.trace && exec.trace.length === 5;
        var finalSummaryMatches = hasFiveSteps && exec.trace[4].summary.indexOf('00001010') !== -1;
        return {
          passed: hasFiveSteps && finalSummaryMatches,
          obtained: (exec.trace ? exec.trace.length : 0) + ' pasos · Resultado traza=' + exec.result.binary,
          expected: '5 pasos · Resultado traza=00001010'
        };
      }
    }
  ];

  function verifyExecution(r, exp) {
    if (!r || !r.ok || r.isReserved) {
      return { passed: false, obtained: 'Error de ejecución', expected: String(exp.unsigned) };
    }
    var ok =
      r.result.unsigned === exp.unsigned &&
      r.flags.Z === exp.Z &&
      r.flags.C === exp.C &&
      r.flags.N === exp.N &&
      r.flags.V === exp.V;

    return {
      passed: ok,
      obtained: r.result.binary + ' (' + r.result.unsigned + ') | Z=' + r.flags.Z + ' C=' + r.flags.C + ' N=' + r.flags.N + ' V=' + r.flags.V,
      expected: exp.unsigned.toString(2).padStart(8, '0') + ' (' + exp.unsigned + ') | Z=' + exp.Z + ' C=' + exp.C + ' N=' + exp.N + ' V=' + exp.V
    };
  }

  var testResults = {};
  var exhaustiveRunning = false;

  function runSingleTest(testId) {
    var tc = TEST_CASES.find(function (t) { return t.id === testId; });
    if (!tc) return null;
    var res = tc.run();
    testResults[tc.id] = res;
    return res;
  }

  function runAllTests() {
    var summary = { total: TEST_CASES.length, passed: 0, failed: 0 };
    for (var i = 0; i < TEST_CASES.length; i++) {
      var res = runSingleTest(TEST_CASES[i].id);
      if (res && res.passed) summary.passed += 1;
      else summary.failed += 1;
    }
    return summary;
  }

  /**
   * Verificación exhaustiva asíncrona de todas las combinaciones de 8 bits × 8 bits × 4 ops = 262,144 casos.
   */
  function runExhaustiveVerification(onProgress, onDone) {
    if (exhaustiveRunning) return;
    exhaustiveRunning = true;

    var opcodes = ['000', '001', '010', '011'];
    var total = 256 * 256 * 4; // 262,144
    var checked = 0;
    var failures = 0;
    var firstFailure = null;
    var a = 0;
    var startTime = performance.now();

    function processChunk() {
      var batchEndA = Math.min(256, a + 4); // 4 * 256 * 4 = 4,096 combinaciones por frame
      for (; a < batchEndA; a++) {
        for (var b = 0; b < 256; b++) {
          for (var oi = 0; oi < 4; oi++) {
            var op = opcodes[oi];
            var actual = ALULab.ALU.executeCoreFast(a, b, op);
            var expected = independentOracle(a, b, op);
            if (
              actual.unsigned !== expected.unsigned ||
              actual.Z !== expected.Z ||
              actual.C !== expected.C ||
              actual.N !== expected.N ||
              actual.V !== expected.V
            ) {
              failures += 1;
              if (!firstFailure) {
                firstFailure = { a: a, b: b, op: op, actual: actual, expected: expected };
              }
            }
            checked += 1;
          }
        }
      }

      if (typeof onProgress === 'function') {
        onProgress({ checked: checked, total: total, failures: failures });
      }

      if (a < 256) {
        global.setTimeout(processChunk, 0);
      } else {
        exhaustiveRunning = false;
        var elapsedMs = Math.round(performance.now() - startTime);
        if (typeof onDone === 'function') {
          onDone({
            checked: checked,
            total: total,
            failures: failures,
            firstFailure: firstFailure,
            elapsedMs: elapsedMs
          });
        }
      }
    }

    processChunk();
  }

  ALULab.Tests = {
    TEST_CASES: TEST_CASES,
    getResults: function () { return testResults; },
    isExhaustiveRunning: function () { return exhaustiveRunning; },
    runSingleTest: runSingleTest,
    runAllTests: runAllTests,
    runExhaustiveVerification: runExhaustiveVerification,
    independentOracle: independentOracle
  };
})(window);
