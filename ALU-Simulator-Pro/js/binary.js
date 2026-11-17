(function (global) {
  'use strict';

  var ALULab = (global.ALULab = global.ALULab || {});

  /**
   * Valida una cadena binaria de exactamente 8 bits ('0' y '1').
   * @param {string} str
   * @returns {{ valid: boolean, value?: string, error?: string }}
   */
  function validateBinary8(str) {
    if (typeof str !== 'string') {
      return { valid: false, error: 'La entrada binaria debe ser una cadena de texto.' };
    }
    var trimmed = str.trim();
    if (trimmed.length !== 8) {
      return {
        valid: false,
        error: 'Debe contener exactamente 8 bits (actual: ' + trimmed.length + ').'
      };
    }
    if (!/^[01]{8}$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Solo se permiten caracteres binarios 0 y 1.'
      };
    }
    return { valid: true, value: trimmed };
  }

  /**
   * Valida un entero decimal en rango sin signo [0, 255] o con signo [-128, 127].
   * @param {string|number} raw
   * @param {'any'|'unsigned'|'signed'} mode
   * @returns {{ valid: boolean, value?: number, unsigned?: number, signed?: number, error?: string }}
   */
  function validateDecimal8(raw, mode) {
    var checkMode = mode || 'any';
    if (raw === '' || raw === null || raw === undefined) {
      return { valid: false, error: 'Ingresa un valor decimal entero.' };
    }
    var str = String(raw).trim();
    if (!/^-?\d+$/.test(str)) {
      return { valid: false, error: 'Solo se permiten números enteros (ej. -128 a 255).' };
    }
    var num = Number(str);
    if (!Number.isSafeInteger(num)) {
      return { valid: false, error: 'Número fuera de precisión entera segura.' };
    }
    if (checkMode === 'unsigned') {
      if (num < 0 || num > 255) {
        return { valid: false, error: 'El rango sin signo permitido es de 0 a 255.' };
      }
    } else if (checkMode === 'signed') {
      if (num < -128 || num > 127) {
        return { valid: false, error: 'El rango con signo permitido es de -128 a 127.' };
      }
    } else {
      if (num < -128 || num > 255) {
        return {
          valid: false,
          error: 'Fuera de rango de 8 bits: usa 0..255 (sin signo) o -128..127 (con signo).'
        };
      }
    }

    var unsigned = num < 0 ? (256 + num) & 0xff : num & 0xff;
    var signed = unsigned >= 128 ? unsigned - 256 : unsigned;

    return {
      valid: true,
      value: num,
      unsigned: unsigned,
      signed: signed
    };
  }

  /**
   * Convierte cadena MSB->LSB ('b7..b0') a arreglo interno LSB-first [b0..b7].
   * @param {string} binStr
   * @returns {number[]}
   */
  function stringToBits(binStr) {
    var check = validateBinary8(binStr);
    if (!check.valid) {
      throw new Error(check.error);
    }
    var bits = new Array(8);
    for (var i = 0; i < 8; i++) {
      bits[i] = check.value.charCodeAt(7 - i) === 49 ? 1 : 0;
    }
    return bits;
  }

  /**
   * Convierte arreglo interno LSB-first [b0..b7] a cadena MSB->LSB ('b7..b0').
   * @param {number[]} bits
   * @returns {string}
   */
  function bitsToString(bits) {
    if (!Array.isArray(bits) || bits.length !== 8) {
      throw new Error('Se esperaba un arreglo de exactamente 8 bits.');
    }
    var chars = new Array(8);
    for (var i = 0; i < 8; i++) {
      chars[7 - i] = bits[i] ? '1' : '0';
    }
    return chars.join('');
  }

  /**
   * @param {number[]} bits
   * @returns {number} 0..255
   */
  function bitsToUnsigned(bits) {
    var total = 0;
    for (var i = 0; i < 8; i++) {
      if (bits[i]) {
        total += 1 << i;
      }
    }
    return total;
  }

  /**
   * @param {number[]} bits
   * @returns {number} -128..127
   */
  function bitsToSigned(bits) {
    var u = bitsToUnsigned(bits);
    return bits[7] === 1 ? u - 256 : u;
  }

  /**
   * @param {number[]} bits
   * @returns {string} Hexadecimal de 2 dígitos, ej. "0xA5"
   */
  function bitsToHex(bits) {
    var u = bitsToUnsigned(bits);
    var hex = u.toString(16).toUpperCase();
    return '0x' + (hex.length < 2 ? '0' + hex : hex);
  }

  /**
   * Convierte un entero (-128..255) a arreglo de 8 bits LSB-first.
   * @param {number} num
   * @returns {number[]}
   */
  function decimalToBits(num) {
    var check = validateDecimal8(num, 'any');
    if (!check.valid) {
      throw new Error(check.error);
    }
    var u = check.unsigned;
    var bits = new Array(8);
    for (var i = 0; i < 8; i++) {
      bits[i] = (u >> i) & 1;
    }
    return bits;
  }

  /**
   * Formatea un arreglo de bits agrupado por nibbles: "1010 0101"
   * @param {number[]} bits
   * @returns {string}
   */
  function formatNibbles(bits) {
    var s = bitsToString(bits);
    return s.slice(0, 4) + ' ' + s.slice(4, 8);
  }

  /**
   * Calcula el complemento a dos bit a bit de un arreglo de 8 bits: NOT(bits) + 1.
   * @param {number[]} bits
   * @returns {{ inverted: number[], twosComplement: number[] }}
   */
  function computeTwosComplement(bits) {
    var inverted = new Array(8);
    for (var i = 0; i < 8; i++) {
      inverted[i] = bits[i] ? 0 : 1;
    }
    var twos = new Array(8);
    var carry = 1;
    for (var j = 0; j < 8; j++) {
      var sum = inverted[j] + carry;
      twos[j] = sum & 1;
      carry = sum >> 1;
    }
    return {
      inverted: inverted,
      twosComplement: twos
    };
  }

  ALULab.Binary = {
    validateBinary8: validateBinary8,
    validateDecimal8: validateDecimal8,
    stringToBits: stringToBits,
    bitsToString: bitsToString,
    bitsToUnsigned: bitsToUnsigned,
    bitsToSigned: bitsToSigned,
    bitsToHex: bitsToHex,
    decimalToBits: decimalToBits,
    formatNibbles: formatNibbles,
    computeTwosComplement: computeTwosComplement
  };
})(window);
