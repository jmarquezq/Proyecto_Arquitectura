(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  /**
   * Calcula las banderas del procesador (Z, C, N, V) a partir del estado real de la ALU.
   *
   * Convenciones de arquitectura de 8 bits:
   * - Z (Zero): 1 cuando los 8 bits del resultado son exactamente 0.
   * - N (Negative): igual al bit más significativo del resultado (bit 7).
   * - C (Carry / Borrow):
   *     * ADD (000): acarreo de salida del sumador de bit 7 (Cout).
   *     * SUB (001): bandera de PRÉSTAMO (Borrow): 1 cuando A < B sin signo (equivalente a Cout_sumador = 0).
   *     * AND (010) / OR (011): 0.
   * - V (Overflow):
   *     * ADD (000) y SUB (001): C_in_MSB XOR C_out_MSB (desbordamiento aritmético con signo).
   *     * AND (010) / OR (011): 0.
   *
   * @param {Object} params
   * @param {'ADD'|'SUB'|'AND'|'OR'} params.opType
   * @param {number[]} params.resultBits
   * @param {number} params.adderCarryOut
   * @param {number} params.adderCarryInMSB
   * @returns {{ Z: number, C: number, N: number, V: number, details: Object }}
   */
  function computeFlags(params) {
    var opType = params.opType;
    var r = params.resultBits;
    var cOut = params.adderCarryOut ? 1 : 0;
    var cInMSB = params.adderCarryInMSB ? 1 : 0;

    // Z = NOR de los 8 bits del resultado
    var anyOne = 0;
    for (var i = 0; i < 8; i++) {
      if (r[i] === 1) {
        anyOne = 1;
        break;
      }
    }
    var Z = anyOne === 0 ? 1 : 0;

    // N = MSB (bit 7)
    var N = r[7] === 1 ? 1 : 0;

    var C = 0;
    var V = 0;
    var cReason = 'Operación lógica: C se fuerza a 0.';
    var vReason = 'Operación lógica: V se fuerza a 0.';

    if (opType === 'ADD') {
      C = cOut;
      V = cInMSB ^ cOut;
      cReason = C === 1
        ? 'Acarreo de salida en el bit 7 (A + B >= 256 sin signo).'
        : 'Sin acarreo de salida en el bit 7 (A + B < 256 sin signo).';
      vReason = V === 1
        ? 'Desbordamiento con signo: C_in(bit7)=' + cInMSB + ' ≠ C_out(bit7)=' + cOut + '.'
        : 'Sin desbordamiento con signo: C_in(bit7)=' + cInMSB + ' = C_out(bit7)=' + cOut + '.';
    } else if (opType === 'SUB') {
      // En complemento a 2 (A + NOT(B) + 1), Cout=1 significa A >= B (sin préstamo) y Cout=0 significa A < B (préstamo).
      C = cOut === 0 ? 1 : 0;
      V = cInMSB ^ cOut;
      cReason = C === 1
        ? 'Préstamo activo (Borrow = 1): A < B en aritmética sin signo (Cout del sumador = 0).'
        : 'Sin préstamo (Borrow = 0): A >= B en aritmética sin signo (Cout del sumador = 1).';
      vReason = V === 1
        ? 'Desbordamiento con signo en resta: C_in(bit7)=' + cInMSB + ' ≠ C_out(bit7)=' + cOut + '.'
        : 'Sin desbordamiento con signo: C_in(bit7)=' + cInMSB + ' = C_out(bit7)=' + cOut + '.';
    }

    return {
      Z: Z,
      C: C,
      N: N,
      V: V,
      details: {
        Z: Z === 1 ? 'Resultado exactamente igual a 00000000 (0).' : 'Resultado distinto de cero.',
        C: cReason,
        N: N === 1 ? 'Bit más significativo (bit 7) es 1 (negativo en complemento a 2).' : 'Bit más significativo (bit 7) es 0.',
        V: vReason
      }
    };
  }

  ALULab.Flags = {
    computeFlags: computeFlags
  };
})(window);
