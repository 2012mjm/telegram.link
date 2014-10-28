//       telegram.link
//
//       Copyright 2014 Enrico Stara 'enrico.stara@gmail.com'
//       Released under the BSD-3-Clause license
//       http://telegram.link

//      PublicKey class
//
// This class represents a Public Key

// The constructor requires the fingerprint, the modulus and the exponent
function PublicKey(params) {
    this._fingerprint = params.fingerprint;
    this._modulus = params.modulus;
    this._exponent = params.exponent;
}

PublicKey.prototype.getFingerprint = function () {
    return this._fingerprint;
};

PublicKey.prototype.getModulus = function () {
    return this._modulus;
};

PublicKey.prototype.getExponent = function () {
    return this._exponent;
};

// The key store
var keyStore = {};

// Add a key to key store, it requires the fingerprint, the key and the exponent:
//
//  PublicKey.addKey{fingerprint: '...', modulus: '...', exponent: '...'});
//
PublicKey.addKey = function (params) {
    var newKey = new PublicKey(params);
    keyStore[newKey.getFingerprint()] = newKey;
};

// Retrieve a key with the fingerprint
PublicKey.retrieveKey = function (fingerprint) {
    return keyStore[fingerprint];
};

// Export the class
module.exports = exports = PublicKey;
