(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  var OPCODE_TABLE = {
    '000': { code: '000', mnemonic: 'ADD', name: 'Suma aritmética', reserved: false, description: 'Suma binaria mediante 8 sumadores completos encadenados.' },
    '001': { code: '001', mnemonic: 'SUB', name: 'Resta (Complemento a 2)', reserved: false, description: 'Calcula A - B como A + NOT(B) + 1 usando el sumador de 8 bits.' },
    '010': { code: '010', mnemonic: 'AND', name: 'Compuerta lógica AND', reserved: false, description: 'Conjunción bit a bit (Ai AND Bi) con C = 0 y V = 0.' },
    '011': { code: '011', mnemonic: 'OR', name: 'Compuerta lógica OR', reserved: false, description: 'Disyunción bit a bit (Ai OR Bi) con C = 0 y V = 0.' },
    '100': { code: '100', mnemonic: 'RES', name: 'Código reservado (100)', reserved: true, description: 'Código de control reservado para expansión futura de la ISA.' },
    '101': { code: '101', mnemonic: 'RES', name: 'Código reservado (101)', reserved: true, description: 'Código de control reservado para expansión futura de la ISA.' },
    '110': { code: '110', mnemonic: 'RES', name: 'Código reservado (110)', reserved: true, description: 'Código de control reservado para expansión futura de la ISA.' },
    '111': { code: '111', mnemonic: 'RES', name: 'Código reservado (111)', reserved: true, description: 'Código de control reservado para expansión futura de la ISA.' }
  };

  /**
   * Sumador completo (Full Adder) de 1 bit.
   * Sum = A XOR B XOR Cin
   * Cout = (A AND B) OR (Cin AND (A XOR B))
   * @param {number} a
   * @param {number} b
   * @param {number} cin
   */
  function fullAdder(a, b, cin) {
    var bitA = a ? 1 : 0;
    var bitB = b ? 1 : 0;
    var bitCin = cin ? 1 : 0;

    var halfSum = bitA ^ bitB;
    var generate = bitA & bitB;
    var propagateCarry = bitCin & halfSum;
    var sum = halfSum ^ bitCin;
    var cout = generate | propagateCarry;

    return {
      a: bitA,
      b: bitB,
      cin: bitCin,
      halfSum: halfSum,
      generate: generate,
      propagateCarry: propagateCarry,
      sum: sum,
      cout: cout
    };
  }

  /**
   * Sumador con acarreo propagado (Ripple-Carry Adder) de 8 bits:
   * ocho sumadores completos conectados en cascada (bit 0 -> bit 7).
   * @param {number[]} bitsA
   * @param {number[]} bitsB
   * @param {number} cinInitial
   */
  function rippleCarryAdder8(bitsA, bitsB, cinInitial) {
    var sumBits = new Array(8);
    var stages = new Array(8);
    var carries = new Array(9);
    carries[0] = cinInitial ? 1 : 0;

    for (var i = 0; i < 8; i++) {
      var fa = fullAdder(bitsA[i], bitsB[i], carries[i]);
      sumBits[i] = fa.sum;
      carries[i + 1] = fa.cout;
      stages[i] = {
        bitIndex: i,
        a: fa.a,
        b: fa.b,
        cin: fa.cin,
        halfSum: fa.halfSum,
        sum: fa.sum,
        cout: fa.cout
      };
    }

    return {
      bits: sumBits,
      stages: stages,
      carries: carries,
      cInMSB: carries[7],
      cOut: carries[8]
    };
  }

  /**
   * Inversor bit a bit de 8 bits (NOT B).
   * @param {number[]} bits
   */
  function invertBits8(bits) {
    var out = new Array(8);
    for (var i = 0; i < 8; i++) {
      out[i] = bits[i] ? 0 : 1;
    }
    return out;
  }

  /**
   * Arreglo de 8 compuertas AND de 2 entradas.
   * @param {number[]} bitsA
   * @param {number[]} bitsB
   */
  function bitwiseAnd8(bitsA, bitsB) {
    var out = new Array(8);
    var gates = new Array(8);
    for (var i = 0; i < 8; i++) {
      var r = (bitsA[i] & bitsB[i]) ? 1 : 0;
      out[i] = r;
      gates[i] = { bitIndex: i, a: bitsA[i], b: bitsB[i], out: r };
    }
    return { bits: out, gates: gates };
  }

  /**
   * Arreglo de 8 compuertas OR de 2 entradas.
   * @param {number[]} bitsA
   * @param {number[]} bitsB
   */
  function bitwiseOr8(bitsA, bitsB) {
    var out = new Array(8);
    var gates = new Array(8);
    for (var i = 0; i < 8; i++) {
      var r = (bitsA[i] | bitsB[i]) ? 1 : 0;
      out[i] = r;
      gates[i] = { bitIndex: i, a: bitsA[i], b: bitsB[i], out: r };
    }
    return { bits: out, gates: gates };
  }

  /**
   * Multiplexor 4:1 controlado por los 3 bits de operación (S2 S1 S0).
   * @param {string} opcode
   * @param {Object} channels
   */
  function multiplexer4to1(opcode, channels) {
    if (opcode === '000') {
      return { selectedChannel: 'ADD', bits: channels.addBits };
    }
    if (opcode === '001') {
      return { selectedChannel: 'SUB', bits: channels.subBits };
    }
    if (opcode === '010') {
      return { selectedChannel: 'AND', bits: channels.andBits };
    }
    if (opcode === '011') {
      return { selectedChannel: 'OR', bits: channels.orBits };
    }
    return { selectedChannel: 'RESERVED', bits: null };
  }

  /**
   * Normaliza un operando de entrada (cadena binaria de 8 bits o número entero).
   * @param {string|number|number[]} input
   * @param {string} label
   */
  function parseOperand(input, label) {
    var Binary = ALULab.Binary;
    if (Array.isArray(input)) {
      if (input.length !== 8) {
        return { valid: false, error: label + ': el arreglo debe tener 8 bits.' };
      }
      var cleanBits = input.map(function (b) { return b ? 1 : 0; });
      return { valid: true, bits: cleanBits };
    }
    if (typeof input === 'string') {
      var trimmed = input.trim();
      var binCheck = Binary.validateBinary8(trimmed);
      if (!binCheck.valid) {
        return { valid: false, error: label + ': ' + binCheck.error };
      }
      return { valid: true, bits: Binary.stringToBits(binCheck.value) };
    }
    if (typeof input === 'number') {
      var decCheck = Binary.validateDecimal8(input, 'any');
      if (!decCheck.valid) {
        return { valid: false, error: label + ': ' + decCheck.error };
      }
      return { valid: true, bits: Binary.decimalToBits(decCheck.value) };
    }
    return { valid: false, error: label + ': tipo de entrada no soportado.' };
  }

  /**
   * Ejecuta la ALU de 8 bits completa y genera la traza de hardware determinista.
   * @param {string|number|number[]} operandA
   * @param {string|number|number[]} operandB
   * @param {string} opcode - '000' .. '111'
   */
  function execute(operandA, operandB, opcode) {
    var Binary = ALULab.Binary;
    var Flags = ALULab.Flags;

    var opStr = typeof opcode === 'string' ? opcode.trim() : '';
    var opMeta = OPCODE_TABLE[opStr];
    if (!opMeta) {
      return {
        ok: false,
        error: 'Código de control inválido ("' + opcode + '"). Debe ser una palabra binaria de 3 bits (000–111).'
      };
    }

    var parsedA = parseOperand(operandA, 'Operando A');
    if (!parsedA.valid) {
      return { ok: false, error: parsedA.error };
    }
    var parsedB = parseOperand(operandB, 'Operando B');
    if (!parsedB.valid) {
      return { ok: false, error: parsedB.error };
    }

    var bitsA = parsedA.bits;
    var bitsB = parsedB.bits;
    var binA = Binary.bitsToString(bitsA);
    var binB = Binary.bitsToString(bitsB);

    // Todas las unidades funcionales calculan en hardware paralelo antes del MUX
    var addUnit = rippleCarryAdder8(bitsA, bitsB, 0);
    var invertedB = invertBits8(bitsB);
    var subUnit = rippleCarryAdder8(bitsA, invertedB, 1);
    var andUnit = bitwiseAnd8(bitsA, bitsB);
    var orUnit = bitwiseOr8(bitsA, bitsB);

    if (opMeta.reserved) {
      return {
        ok: true,
        isReserved: true,
        opcode: opStr,
        operation: opMeta,
        operandA: {
          bits: bitsA,
          binary: binA,
          unsigned: Binary.bitsToUnsigned(bitsA),
          signed: Binary.bitsToSigned(bitsA),
          hex: Binary.bitsToHex(bitsA)
        },
        operandB: {
          bits: bitsB,
          binary: binB,
          unsigned: Binary.bitsToUnsigned(bitsB),
          signed: Binary.bitsToSigned(bitsB),
          hex: Binary.bitsToHex(bitsB)
        },
        units: {
          add: addUnit,
          sub: subUnit,
          invertedB: invertedB,
          and: andUnit,
          or: orUnit
        },
        result: null,
        flags: { Z: 0, C: 0, N: 0, V: 0, details: {} },
        trace: buildReservedTrace(binA, binB, opMeta)
      };
    }

    var mux = multiplexer4to1(opStr, {
      addBits: addUnit.bits,
      subBits: subUnit.bits,
      andBits: andUnit.bits,
      orBits: orUnit.bits
    });

    var activeAdder = opMeta.mnemonic === 'ADD' ? addUnit : subUnit;
    var flags = Flags.computeFlags({
      opType: opMeta.mnemonic,
      resultBits: mux.bits,
      adderCarryOut: activeAdder.cOut,
      adderCarryInMSB: activeAdder.cInMSB
    });

    var resultObj = {
      bits: mux.bits,
      binary: Binary.bitsToString(mux.bits),
      unsigned: Binary.bitsToUnsigned(mux.bits),
      signed: Binary.bitsToSigned(mux.bits),
      hex: Binary.bitsToHex(mux.bits)
    };

    var operandAObj = {
      bits: bitsA,
      binary: binA,
      unsigned: Binary.bitsToUnsigned(bitsA),
      signed: Binary.bitsToSigned(bitsA),
      hex: Binary.bitsToHex(bitsA)
    };

    var operandBObj = {
      bits: bitsB,
      binary: binB,
      unsigned: Binary.bitsToUnsigned(bitsB),
      signed: Binary.bitsToSigned(bitsB),
      hex: Binary.bitsToHex(bitsB)
    };

    var trace = buildExecutionTrace({
      operandA: operandAObj,
      operandB: operandBObj,
      opMeta: opMeta,
      addUnit: addUnit,
      subUnit: subUnit,
      invertedB: invertedB,
      andUnit: andUnit,
      orUnit: orUnit,
      mux: mux,
      result: resultObj,
      flags: flags
    });

    return {
      ok: true,
      isReserved: false,
      opcode: opStr,
      operation: opMeta,
      operandA: operandAObj,
      operandB: operandBObj,
      units: {
        add: addUnit,
        sub: subUnit,
        invertedB: invertedB,
        and: andUnit,
        or: orUnit
      },
      mux: mux,
      result: resultObj,
      flags: flags,
      trace: trace
    };
  }

  function buildExecutionTrace(ctx) {
    var Binary = ALULab.Binary;
    var op = ctx.opMeta.mnemonic;
    var invBStr = Binary.bitsToString(ctx.invertedB);

    var computeDetail = '';
    if (op === 'ADD') {
      computeDetail = 'El sumador de 8 bits encadena 8 sumadores completos: ' +
        ctx.operandA.binary + ' + ' + ctx.operandB.binary + ' = ' +
        ctx.result.binary + ' (Cout = ' + ctx.addUnit.cOut + ').';
    } else if (op === 'SUB') {
      computeDetail = 'Circuito de resta por complemento a 2: NOT(B) = ' + invBStr +
        '; A + NOT(B) + 1 = ' + ctx.operandA.binary + ' + ' + invBStr + ' + 1 = ' +
        ctx.result.binary + ' (Cout sumador = ' + ctx.subUnit.cOut + ', Préstamo C = ' + ctx.flags.C + ').';
    } else if (op === 'AND') {
      computeDetail = 'Las 8 compuertas AND evalúan Ai · Bi en paralelo: ' +
        ctx.operandA.binary + ' AND ' + ctx.operandB.binary + ' = ' + ctx.result.binary + '.';
    } else {
      computeDetail = 'Las 8 compuertas OR evalúan Ai + Bi en paralelo: ' +
        ctx.operandA.binary + ' OR ' + ctx.operandB.binary + ' = ' + ctx.result.binary + '.';
    }

    return [
      {
        stepIndex: 0,
        stage: 'LOAD_OPERANDS',
        title: '1. Carga de registros',
        activeNodes: ['regA', 'regB'],
        activeWires: ['wireA_bus', 'wireB_bus'],
        summary: 'Registro A carga ' + ctx.operandA.binary + ' (' + ctx.operandA.unsigned + ' / ' + ctx.operandA.signed + ') y Registro B carga ' + ctx.operandB.binary + ' (' + ctx.operandB.unsigned + ' / ' + ctx.operandB.signed + ').'
      },
      {
        stepIndex: 1,
        stage: 'DECODE_CONTROL',
        title: '2. Decodificación de control',
        activeNodes: ['regA', 'regB', 'controlUnit'],
        activeWires: ['wireA_bus', 'wireB_bus', 'wireCtrl_mux'],
        summary: 'La Unidad de Control recibe el código ' + ctx.opMeta.code + ' y habilita la ruta funcional ' + ctx.opMeta.mnemonic + ' (' + ctx.opMeta.name + ').'
      },
      {
        stepIndex: 2,
        stage: 'COMPUTE_UNITS',
        title: '3. Procesamiento en unidades',
        activeNodes: op === 'ADD'
          ? ['regA', 'regB', 'adderUnit']
          : op === 'SUB'
            ? ['regA', 'regB', 'subUnit']
            : op === 'AND'
              ? ['regA', 'regB', 'andUnit']
              : ['regA', 'regB', 'orUnit'],
        activeWires: op === 'ADD'
          ? ['wireA_add', 'wireB_add', 'wireAdd_mux']
          : op === 'SUB'
            ? ['wireA_sub', 'wireB_sub', 'wireSub_mux']
            : op === 'AND'
              ? ['wireA_and', 'wireB_and', 'wireAnd_mux']
              : ['wireA_or', 'wireB_or', 'wireOr_mux'],
        summary: computeDetail
      },
      {
        stepIndex: 3,
        stage: 'MUX_SELECT',
        title: '4. Selección en Multiplexor',
        activeNodes: ['controlUnit', 'muxUnit', op === 'ADD' ? 'adderUnit' : op === 'SUB' ? 'subUnit' : op === 'AND' ? 'andUnit' : 'orUnit'],
        activeWires: ['wireCtrl_mux', 'wireMux_res', op === 'ADD' ? 'wireAdd_mux' : op === 'SUB' ? 'wireSub_mux' : op === 'AND' ? 'wireAnd_mux' : 'wireOr_mux'],
        summary: 'El Multiplexor 4:1 selecciona el canal ' + ctx.mux.selectedChannel + ' según el código ' + ctx.opMeta.code + ' y entrega los 8 bits ' + ctx.result.binary + '.'
      },
      {
        stepIndex: 4,
        stage: 'WRITE_RESULT_FLAGS',
        title: '5. Resultado y banderas',
        activeNodes: ['muxUnit', 'resultReg', 'flagsReg'],
        activeWires: ['wireMux_res', 'wireRes_flags'],
        summary: 'Registro de Resultado = ' + ctx.result.binary + ' (' + ctx.result.unsigned + ' sin signo, ' + ctx.result.signed + ' con signo). Banderas: Z=' + ctx.flags.Z + ', C=' + ctx.flags.C + ', N=' + ctx.flags.N + ', V=' + ctx.flags.V + '.'
      }
    ];
  }

  function buildReservedTrace(binA, binB, opMeta) {
    return [
      {
        stepIndex: 0,
        stage: 'LOAD_OPERANDS',
        title: '1. Carga de registros',
        activeNodes: ['regA', 'regB'],
        activeWires: ['wireA_bus', 'wireB_bus'],
        summary: 'Registro A = ' + binA + ' y Registro B = ' + binB + ' listos en el bus de entrada.'
      },
      {
        stepIndex: 1,
        stage: 'DECODE_CONTROL',
        title: '2. Decodificación de control',
        activeNodes: ['controlUnit'],
        activeWires: ['wireCtrl_mux'],
        isError: true,
        summary: 'Código de control ' + opMeta.code + ' identificado como RESERVADO. La ejecución aritmético-lógica se detiene de forma segura sin escribir resultado.'
      }
    ];
  }

  /**
   * Versión rápida optimizada para la verificación exhaustiva de 262,144 combinaciones
   * usando la lógica real del sumador completo de 8 bits sin construir objetos de traza pesados.
   */
  function executeCoreFast(aInt, bInt, opcode) {
    var bitsA = new Array(8);
    var bitsB = new Array(8);
    for (var i = 0; i < 8; i++) {
      bitsA[i] = (aInt >> i) & 1;
      bitsB[i] = (bInt >> i) & 1;
    }

    var outBits;
    var cOut = 0;
    var cInMSB = 0;
    var opType = 'AND';

    if (opcode === '000') {
      opType = 'ADD';
      var addRes = rippleCarryAdder8(bitsA, bitsB, 0);
      outBits = addRes.bits;
      cOut = addRes.cOut;
      cInMSB = addRes.cInMSB;
    } else if (opcode === '001') {
      opType = 'SUB';
      var invB = invertBits8(bitsB);
      var subRes = rippleCarryAdder8(bitsA, invB, 1);
      outBits = subRes.bits;
      cOut = subRes.cOut;
      cInMSB = subRes.cInMSB;
    } else if (opcode === '010') {
      opType = 'AND';
      outBits = bitwiseAnd8(bitsA, bitsB).bits;
    } else if (opcode === '011') {
      opType = 'OR';
      outBits = bitwiseOr8(bitsA, bitsB).bits;
    } else {
      return { isReserved: true };
    }

    var flags = ALULab.Flags.computeFlags({
      opType: opType,
      resultBits: outBits,
      adderCarryOut: cOut,
      adderCarryInMSB: cInMSB
    });

    var val = 0;
    for (var k = 0; k < 8; k++) {
      if (outBits[k]) val += 1 << k;
    }

    return {
      isReserved: false,
      unsigned: val,
      Z: flags.Z,
      C: flags.C,
      N: flags.N,
      V: flags.V
    };
  }

  ALULab.ALU = {
    OPCODE_TABLE: OPCODE_TABLE,
    fullAdder: fullAdder,
    rippleCarryAdder8: rippleCarryAdder8,
    invertBits8: invertBits8,
    bitwiseAnd8: bitwiseAnd8,
    bitwiseOr8: bitwiseOr8,
    multiplexer4to1: multiplexer4to1,
    execute: execute,
    executeCoreFast: executeCoreFast
  };
})(window);
