/**
 * More Modern Version of node-stream-parser
 */

 import assert from 'assert';
 import { Stream, Transform, Writable } from 'stream';
 var debug =  (/** @type {(string | number)[]} */ ...args) => console.log('stream-parser', ...args) //require('debug')('stream-parser');
 
 /**
  * Module exports.
  */
 
 export { Parser };
 
 /**
  * Parser states.
  */
 
 var INIT        = -1;
 var BUFFERING   = 0;
 var SKIPPING    = 1;
 var PASSTHROUGH = 2;
 
 /**
  * The `Parser` stream mixin works with either `Writable` or `Transform` stream
  * instances/subclasses. Provides a convenient generic "parsing" API:
  *
  *   _bytes(n, cb) - buffers "n" bytes and then calls "cb" with the "chunk"
  *   _skipBytes(n, cb) - skips "n" bytes and then calls "cb" when done
  *
  * If you extend a `Transform` stream, then the `_passthrough()` function is also
  * added:
  *
  *   _passthrough(n, cb) - passes through "n" bytes untouched and then calls "cb"
  *
  * @param {TransformStream | WritableStream } stream Transform or Writable stream instance to extend
  * @api public
  */
 
 function Parser(stream) {
   //@ts-ignore
   const isTransform = stream && 'function' == typeof stream._transform;
   //@ts-ignore const isWritable = stream && 'function' == typeof stream._write;

   if (!(stream instanceof TransformStream) && !(stream instanceof WritableStream)) {
       throw new Error('must pass a Writable or Transform stream in');
   }
   
   const parseAbleStream = class extends Transform {
        constructor(inputStream) {
            var isTransform = inputStream && 'function' == typeof inputStream._transform;
            var isWritable = inputStream && 'function' == typeof inputStream._write;
            if (!(inputStream instanceof Transform ) && !(inputStream instanceof Writable)) {
                throw new Error('must pass a Writable or Transform stream in only Transforms at present.');
            }
            
            super();
            const stream = this;
            
            //stream._bytes = _bytes;
            //stream._skipBytes = _skipBytes;

            // take control of the streams2 callback functions for this stream
            if (isTransform && isWritable) {
            //     stream._transform = _transform;
            //     stream._passthrough = _passthrough;
                inputStream.pipe(stream);
            } //else {
            //   stream._write = _write;
            // }
            
            // number of bytes left to parser for the next "chunk"
            stream._parserBytesLeft = 0;

            // array of Buffer instances that make up the next "chunk"
            stream._parserBuffers = [];
            
            // number of bytes parsed so far for the next "chunk"
            stream._parserBuffered = 0;
            
            // flag that keeps track of if what the parser should do with bytes received
            stream._parserState = INIT;
            
            // the callback for the next "chunk"
            stream._parserCallback = null;
            
            // XXX: backwards compat with the old Transform API... remove at some point..
            //    if ('function' == typeof stream.push) {
            //      stream._parserOutput = stream.push.bind(stream);
            //    }
            
            stream._parserInit = false //true;

        }
        // Transform streams and Writable streams get `_bytes()` and `_skipBytes()`
        /**
         * Buffers `n` bytes and then invokes `fn` once that amount has been collected.
         *
         * @param {Number} n the number of bytes to buffer
         * @param {Function} fn callback function to invoke when `n` bytes are buffered
         * @api public
         */
        
         _bytes (n, fn) {
            assert(!this._parserCallback, 'there is already a "callback" set!');
            assert(isFinite(n) && n > 0, 'can only buffer a finite number of bytes > 0, got "' + n + '"');
            if (!this._parserInit) init(this);
            debug('buffering %o bytes', n);
            this._parserBytesLeft = n;
            this._parserCallback = fn;
            this._parserState = BUFFERING;
        }
        
        /**
         * Skips over the next `n` bytes, then invokes `fn` once that amount has
         * been discarded.
         *
         * @param {Number} n the number of bytes to discard
         * @param {Function} fn callback function to invoke when `n` bytes have been skipped
         * @api public
         */
        
        _skipBytes(n, fn) {
            assert(!this._parserCallback, 'there is already a "callback" set!');
            assert(n > 0, 'can only skip > 0 bytes, got "' + n + '"');
            if (!this._parserInit) init(this);
            debug('skipping %o bytes', n);
            this._parserBytesLeft = n;
            this._parserCallback = fn;
            this._parserState = SKIPPING;
        }
        data(stream, chunk, push = ()=>{ }, writeCallback) {
            let result = _data.apply(this, arguments);
    
            while ('function' == typeof result) {
                result = result();
            }
    
            return result;
        };
        // Only Write Able Streams?
        /**
         * The `_write()` callback function implementation.
         * @param {*} chunk 
         * @param {*} encoding 
         * @param {*} writeCallback (null, data)
         * @api private
         */
        _write(chunk, encoding='buffer', writeCallback) {
            debug('write(%o bytes)', chunk.length, encoding);
            this.data(this, chunk, encoding, writeCallback);
        }
        _writev(chunks, writeCallback) {
            for (const chunkObj of chunks) {
                const { chunk } = chunkObj;
                debug('write(%o bytes)', chunk.length, encoding);
                this.data(this, chunk, null, writeCallback);
            }
        }
        // Only Transform streams
        /**
         * Passes through `n` bytes to the readable side of this stream untouched,
         * then invokes `callbackAfterNBytesPassed` once that amount has been passed through.
         *
         * @param {Number} n the number of bytes to pass through
         * @param {Function} callbackAfterNBytesPassed callback function to invoke when `n` bytes have passed through
         * @api public
         */
         _passthrough(n, callbackAfterNBytesPassed) {
            assert(!this._parserCallback, 'There is already a "callback" set!');
            assert(n > 0, 'can only pass through > 0 bytes, got "' + n + '"');
            debug('passing through %o bytes', n);
            this._parserBytesLeft = n;
            this._parserCallback = callbackAfterNBytesPassed;
            this._parserState = PASSTHROUGH;
        }

        /**
         * The `_transform()` callback function implementation.
         *
         * @api private
         */        
        _transform(chunk, encoding, fn) {
            debug('transform(%o bytes)', chunk.length);
            this.data(this, chunk, this.push.bind(this), fn);
        }
    
   
 }
}

 

 
 /**
  * The internal buffering/passthrough logic...
  *
  * This `_data` function get's "trampolined" to prevent stack overflows for tight
  * loops. This technique requires us to return a "thunk" function for any
  * synchronous action. Async stuff breaks the trampoline, but that's ok since it's
  * working with a new stack at that point anyway.
  * 
  * this is cutting the data into pices each max parserBytesLeft in size
  *
  * @api private
  */
 function _data (stream, chunk, output, fn) {
   if (stream._parserBytesLeft <= 0) {
     return fn(new Error('got data but not currently parsing anything'));
   }
   const chunkFitsWithinBytesLeft = chunk.length <= stream._parserBytesLeft
   return chunkFitsWithinBytesLeft 
    ? () => process(stream, chunk, output, fn) 
    : () => {
        var parserChunk = chunk.slice(0, stream._parserBytesLeft);
        return process(stream, parserChunk, output, (err) => {
            if (err) {
                return fn(err);
            }
            if (chunk.length > parserChunk.length) {
                return () => {
                    const streamedBytedLeft = chunk.slice(parserChunk.length)
                    return _data(stream, streamedBytedLeft, output, fn);
                };
            }
        });
    };
    

 }
 
 /**
  * The internal `process` function gets called by the `_data` function when
  * something "interesting" happens. This function takes care of buffering the
  * bytes when buffering, passing through the bytes when doing that, and invoking
  * the user callback when the number of bytes has been reached.
  *
  * @api private
  */
 
 function process (stream, chunk, output, fn) {
   stream._parserBytesLeft -= chunk.length;
   debug('%o bytes left for stream piece', stream._parserBytesLeft);
 
   if (stream._parserState === BUFFERING) {
     // buffer
     stream._parserBuffers.push(chunk);
     stream._parserBuffered += chunk.length;
   } else if (stream._parserState === PASSTHROUGH) {
     // passthrough
     stream.push(chunk);
   }
   
   const fullFrameParsed = (BUFFERING === stream._parserBytesLeft);
   if (fullFrameParsed) {
    const frame = (stream._parserCallback && stream._parserState === BUFFERING && stream._parserBuffers.length > 1) 
    ? Buffer.concat(stream._parserBuffers, stream._parserBuffered)
    : (stream._parserState === BUFFERING) ? chunk : undefined;
    
    const currentCallback = stream._parserCallback;
    // Reset State
    stream._parserCallback = null;
    stream._parserBuffered = 0;
    stream._parserState = INIT;
    stream._parserBuffers.splice(0); // empty
 
    if (currentCallback) {
        var args = [frame,stream.push].filter(x=>x); // [frame, stream.push.bind(stream,trampolin(writeCallback))]
        var async = currentCallback.length > args.length;
        if (async) {
            args.push(trampoline(fn));
        }
        // invoke parserCallback
        var rtn = currentCallback.apply(stream, args);
        if (!async || fn === rtn) {
            return fn; 
        }
    }
   } else {
     // need more bytes
     return fn;
   }
 }
 
 /**
  * Generic thunk-based "trampoline" helper function.
  *
  * @param {Function} fn function
  * @return {Function} "trampolined" function
  * @api private
  */
 
function trampoline (fn) {
    return function () {
        let result = fn.apply(this, arguments);

        while ('function' == typeof result) {
            result = result();
        }

        return result;
    };
}

const data = trampoline(_data);
