//       telegram.link
//
//       Copyright 2014 Enrico Stara 'enrico.stara@gmail.com'
//       Released under the Simplified BSD License
//       http://telegram.link

//      TcpConnection class
//
// This class provides a TCP socket to communicate with `Telegram` using `MTProto` protocol

// Import dependencies
var net = require('net');
var util = require('util');
var AbstractObject = require("../type-language").AbstractObject;
var logger = require('get-log')('net.TcpConnection');

// The constructor accepts optionally an object to specify the connection address as following:
//
//      new TcpConnection({host: "173.240.5.253", port: "443"});
//
// `localhost:80` address is used as default otherwise
function TcpConnection(options) {
    this.options = util._extend({ host: 'localhost', port: '80', localAddress: process.env.LOCAL_ADDRESS }, options);
    this._config = JSON.stringify(this.options);
    if (logger.isDebugEnabled()) logger.debug('Created with %s', this._config);
}

// This method opens the connection and calls back when done
TcpConnection.prototype.connect = function (callback) {
    var self = this;
    if (logger.isDebugEnabled()) logger.debug('Connecting to %s', self._config);
    if (this._socket) {
        if (callback) {
            callback(null);
        }
        return;
    }
    var onError = function (e) {
        socket.removeListener('error', onError);
        logger.error('Error %s connecting to %s', e.code, self._config);
        this._socket = undefined;
        if (callback) {
            callback(e);
        }
    };
    var socket = net.connect(this.options, function () {
        socket.removeListener('error', onError);

        if (logger.isDebugEnabled()) logger.debug('Connected to ' + self._config);

        var abridgedFlag = new Buffer(1);
        abridgedFlag.writeUInt8(0xef, 0);
        if (logger.isDebugEnabled()) logger.debug('Sending abridgedFlag to ' + self._config);
        socket.write(abridgedFlag, 'UTF8', function () {
            if (logger.isDebugEnabled()) logger.debug('AbridgedFlag sent to ' + self._config);
            if (callback) {
                callback(null);
            }
        });
    });
    socket.setKeepAlive(true);
    socket.setNoDelay(true);
    socket.on('error', onError);
    this._socket = socket;
};

// This method writes the given data and calls back when done
TcpConnection.prototype.write = function (data, callback) {
    var self = this;
    var socket = this._socket;
    if (!socket && callback) {
        callback(createError('Not yet connected', 'ENOTCONNECTED'));
        return;
    }
    if ((data.length % 4) !== 0 && callback) {
        callback(createError('Data length must be multiple of 4','EMULTIPLE4'));
        return;
    }
    if (!Buffer.isBuffer(data)) {
        if (logger.isDebugEnabled()) logger.debug('Given data is not a Buffer');
        data = new Buffer(data);
    }
    var message = new TcpConnection.Message({message: data});
    var request = message.serialize();
    if (logger.isDebugEnabled()) logger.debug('Writing %s to %s', request.toString('hex'), self._config);
    var onError = function (e) {
        socket.removeListener('error', arguments.callee);
        logger.error('Error %s writing %s bytes to %s', e.code, request.length, self._config);
        if (callback) {
            callback(e);
        }
    };
    socket.write(request, 'UTF8', function () {
        if (logger.isDebugEnabled()) logger.debug('Wrote %s bytes to %s', request.length, self._config);
        socket.removeListener('error', onError);
        if (callback) {
            callback(null);
        }
    });
    socket.on('error', onError);
};

// This method reads the data from the connection and calls back when done
TcpConnection.prototype.read = function (callback) {
    var self = this;
    if (logger.isDebugEnabled()) logger.debug('Reading from %s', self._config);
    var socket = this._socket;
    if (!socket && callback) {
        callback(createError('Not yet connected', 'ENOTCONNECTED'));
        return;
    }
    var onError = function (e) {
        socket.removeListener('error', arguments.callee);
        logger.error('Error %s reading from %s', e.code, self._config);
        if (callback) {
            callback(e);
        }
    };
    var onData = function (data) {
        socket.removeListener('data', arguments.callee);
        socket.removeListener('error', onError);
        var message = new TcpConnection.Message({buffer: data}).deserialize();
        var payload = message.getMessage();
        if (logger.isDebugEnabled()) logger.debug('Read %s bytes from %s', payload.toString('hex'), self._config);

        if (callback) {
            callback(null, payload);
        }
    };
    socket.on('data', onData);
    socket.on('error', onError);
};

// This method close the connection and calls back when done
TcpConnection.prototype.close = function (callback) {
    var self = this;
    var socket = this._socket;
    if (socket) {
        if (logger.isDebugEnabled()) logger.debug('Disconnecting from ' + self._config);
        var onError = function (e) {
            socket.removeListener('error', arguments.callee);
            logger.error('Error %s disconnecting from %s', e.code, self._config);
            if (callback) {
                callback(e);
            }
        };
        socket.on('end', function () {
            socket.removeListener('end', arguments.callee);
            socket.removeListener('error', onError);
            if (logger.isDebugEnabled()) logger.debug('Disconnected from ' + self._config);
            if (callback) {
                callback(null);
            }
        });
        socket.on('error', onError);
        socket.end();
        this._socket = undefined;
    } else if (callback) {
        callback(null);
    }
};

function createError(msg, code) {
    var error  = new Error(msg);
    error.code = code;
    return error;
}

// TcpConnection inner class:
//
//      TcpConnection.Message class
//
// To get an instance for `serialization`:
//
//      new TcpConnection.Message({message: myMessageBuffer});
// Provide the payload as `Buffer`:
//
// To get an instance for `de-serialization`:
//
//      new TcpConnection.Message({buffer: myBuffer});
// Provide a `buffer` containing the plain message from which extract the payload
//
// The `constructor`:
TcpConnection.Message = function (options) {
    var super_ = this.constructor.super_.bind(this);
    var opts = options ? options : {};
    this._message = opts.message;
    super_(opts.buffer, opts.offset);
    if (this._message) {
        this._message = Buffer.isBuffer(this._message) ? this._message : new Buffer(this._message, 'hex');
    }
};

util.inherits(TcpConnection.Message, AbstractObject);

// This method serialize the Message
TcpConnection.Message.prototype.serialize = function () {
    if (!this._message) {
        return false;
    }
    this.writeBytes(this._message, true);
    return this.retrieveBuffer();
};

// This method de-serialize the Message
TcpConnection.Message.prototype.deserialize = function () {
    if (!this.isReadonly()) {
        return false;
    }
    this._message = this.readBytes(true);
    return this;
};

// This method returns the payload
TcpConnection.Message.prototype.getMessage = function () {
    return this._message;
};

// Export the class
module.exports = exports = TcpConnection;