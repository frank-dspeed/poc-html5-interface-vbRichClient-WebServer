/// <reference path="@types/mocha"/> 
/// <reference path="@types/node"/> 
/**
 * 
 */

/**
 * Module dependencies.
 */
import { 
    Transform, 
    Writable 
} from 'stream'; // readable-stream as shim

import assert from 'assert';
import Parser from './stream-parser.js';
 
describe('Transform stream', function () {
 
   it('should have the `_bytes()` function', function () {
     var t = new Transform();
     Parser(t);
     assert.equal('function', typeof t._bytes);
   });
 
   it('should have the `_skipBytes()` function', function () {
     var t = new Transform();
     Parser(t);
     assert.equal('function', typeof t._skipBytes);
   });
 
   it('should have the `_passthrough()` function', function () {
     var t = new Transform();
     Parser(t);
     assert.equal('function', typeof t._passthrough);
   });
 
   it('should read 2 bytes, pass through 2 bytes', function (done) {
     var t = new Transform();
     Parser(t);
     var gotBytes = false;
     var gotPassthrough = false;
     var gotData = false;
 
     // read 2 bytes
     t._bytes(2, read);
     function read (chunk, output) {
       assert.equal(2, chunk.length);
       assert.equal(0, chunk[0]);
       assert.equal(1, chunk[1]);
       gotBytes = true;
       t._passthrough(2, passthrough);
     }
     function passthrough (output) {
       gotPassthrough = true;
     }
 
     t.on('data', function (data) {
       assert.equal(2, data.length);
       assert.equal(2, data[0]);
       assert.equal(3, data[1]);
       gotData = true;
     });
 
     t.on('end', function () {
       assert(gotBytes);
       assert(gotPassthrough);
       assert(gotData);
       done();
     });
 
     t.end(Buffer.from([ 0, 1, 2, 3 ]));
   });
 
   it('should allow you to pass through Infinity bytes', function (done) {
     var t = new Transform();
     Parser(t);
     t._passthrough(Infinity);
     var out = [];
     t.on('data', function (data) {
       out.push(data);
     });
     t.on('end', function () {
       assert.equal('hello world', Buffer.concat(out).toString());
       done();
     });
     t.end('hello world');
   });
 
   it('should *not* allow you to buffer Infinity bytes', function () {
     // buffering to Infinity would just be silly...
     var t = new Transform();
     Parser(t);
     assert.throws(function () {
       t._bytes(Infinity);
     });
   });
 
   it('should not cause stack overflow', function (done) {
     // this one does an admirable amount of CPU work...
     this.test.slow(500);
     this.test.timeout(1000);
 
     var t = new Transform();
     Parser(t);
 
     var bytes = 65536;
     t._bytes(1, read);
     function read() {
       // Any downstream pipe consumer (writable) which doesn't do any async actions.
       // e.g. console.log, or simply capturing data into an in-memory data-structure.
       if (--bytes) {
         t._bytes(1, read);
       } else {
         done();
       }
     }
 
     var b = Buffer.alloc(bytes,'h');
     //b.fill('h');
     t.end(b);
   });
 
   describe('async', function () {
 
     it('should accept a callback function for `_passthrough()`', function (done) {
       var t = new Transform();
       var data = 'test', _data;
       Parser(t);
       t._passthrough(data.length, function (output, fn) {
         setTimeout(fn, 25);
       });
 
       t.on('data', function (data) {
         _data = data;
       });
       t.on('end', function () {
         assert.equal(data, _data);
         done();
       });
       t.end(data);
       t.resume();
     });
 
     it('should accept a callback function for `_bytes()`', function (done) {
       var t = new Transform();
       var data = 'test';
       Parser(t);
       t._bytes(data.length, function (chunk, output, fn) {
         setTimeout(fn, 25);
       });
 
       t.on('end', function () {
         done();
       });
       t.end(data);
       t.resume();
     });
 
     it('should work switching between async and sync callbacks', function (done) {
       var firstCalled, secondCalled, thirdCalled;
 
       // create a 6 byte Buffer. The first 4 will be the int
       // `1337`. The last 2 will be whatever...
       var val = 1337;
       var buf = new Buffer(6);
       buf.writeUInt32LE(val, 0);
 
       var t = new Transform();
       Parser(t);
 
       // first read 4 bytes, with an async callback
       function first (chunk, output, fn) {
         firstCalled = true;
         assert.equal(chunk.length, 4);
         assert.equal(val, chunk.readUInt32LE(0));
 
         t._bytes(1, second);
         setTimeout(fn, 10);
       }
 
       // second read 1 byte, sync callback
       function second (chunk) {
         secondCalled = true;
         assert.equal(chunk.length, 1);
         t._bytes(1, third);
       }
 
       // third read 1 byte, async callback
       function third (chunk, output, fn) {
         thirdCalled = true;
         assert.equal(chunk.length, 1);
         setTimeout(fn, 10);
       }
 
       t.on('finish', function () {
         assert(firstCalled);
         assert(secondCalled);
         assert(thirdCalled);
         done();
       });
 
       t._bytes(4, first);
       t.write(buf);
       t.end();
     });
 
   });
 
 });

 describe('Writable streams', function () {

    var val = 1337;
    var buf = new Buffer(4);
    buf.writeUInt32LE(val, 0);
  
    it('should have the `_bytes()` function', function () {
      var w = new Writable();
      Parser(w);
      assert.equal('function', typeof w._bytes);
    });
  
    it('should have the `_skipBytes()` function', function () {
      var w = new Writable();
      Parser(w);
      assert.equal('function', typeof w._skipBytes);
    });
  
    it('should *not* have the `_passthrough()` function', function () {
      var w = new Writable();
      Parser(w);
      assert.notEqual('function', typeof w._passthrough);
    });
  
    it('should read 4 bytes in one chunk', function (done) {
      var w = new Writable();
      Parser(w);
  
      // read 4 bytes
      w._bytes(4, function (chunk) {
        assert.equal(chunk.length, buf.length);
        assert.equal(val, chunk.readUInt32LE(0));
        done();
      });
  
      w.end(buf);
    });
  
    it('should read 4 bytes in multiple chunks', function (done) {
      var w = new Writable();
      Parser(w);
  
      // read 4 bytes
      w._bytes(4, function (chunk) {
        assert.equal(chunk.length, buf.length);
        assert.equal(val, chunk.readUInt32LE(0));
        done();
      });
  
      for (var i = 0; i < buf.length; i++) {
        w.write(new Buffer([ buf[i] ]));
      }
      w.end();
    });
  
    it('should read 1 byte, 2 bytes, then 3 bytes', function (done) {
      var w = new Writable();
      Parser(w);
  
      // read 1 byte
      w._bytes(1, readone);
      function readone (chunk) {
        assert.equal(1, chunk.length);
        assert.equal(0, chunk[0]);
        w._bytes(2, readtwo);
      }
      function readtwo (chunk) {
        assert.equal(2, chunk.length);
        assert.equal(0, chunk[0]);
        assert.equal(1, chunk[1]);
        w._bytes(3, readthree);
      }
      function readthree (chunk) {
        assert.equal(3, chunk.length);
        assert.equal(0, chunk[0]);
        assert.equal(1, chunk[1]);
        assert.equal(2, chunk[2]);
        done();
      }
  
      w.end(new Buffer([ 0, 0, 1, 0, 1, 2 ]));
    });
  
    it('should work when mixing in to a subclass\' `prototype`', function (done) {
      function MyWritable () {
        Writable.call(this);
        this._bytes(2, this.onbytes);
      }
      inherits(MyWritable, Writable);
  
      // mixin to the `prototype`
      Parser(MyWritable.prototype);
  
      var count = 2;
      MyWritable.prototype.onbytes = function (buf) {
        assert.equal(2, buf.length);
        assert.equal(0, buf[0]);
        assert.equal(1, buf[1]);
        --count;
        if (!count) done();
      };
  
      var a = new MyWritable();
      var b = new MyWritable();
  
      // interleave write()s
      a.write(new Buffer([ 0 ]));
      b.write(new Buffer([ 0 ]));
      a.write(new Buffer([ 1 ]));
      b.write(new Buffer([ 1 ]));
      a.end();
      b.end();
    });
  
    it('should *not* allow you to buffer Infinity bytes', function () {
      // buffering to Infinity would just be silly...
      var w = new Writable();
      Parser(w);
      assert.throws(function () {
        w._bytes(Infinity);
      });
    });
  
    it('should skip 3 bytes then buffer 3 bytes', function (done) {
      var w = new Writable();
      Parser(w);
  
      w._skipBytes(3, function () {
        assert.equal(arguments.length, 0);
        w._bytes(3, function (data) {
          assert.equal(arguments.length, 1);
          assert.equal(data.toString('ascii'), 'lo\n');
          done();
        });
      });
  
      w.end('hello\n');
    });
  
    describe('async', function () {
  
      it('should accept a callback function for `_bytes()`', function (done) {
        var w = new Writable();
        var data = 'test';
        Parser(w);
        w._bytes(data.length, function (chunk, fn) {
          setTimeout(fn, 25);
        });
        w.on('finish', function () {
          done();
        });
        w.end(data);
      });
  
      it('should emit an "error" event when data is written with no parsing function', function (done) {
        var w = new Writable();
        Parser(w);
        w.once('error', function (err) {
          assert(err);
          done();
        });
        w.write('a');
      });
  
    });
  
    describe('FrameParser', function () {
      function FrameParser () {
        Writable.call(this);
        this._bytes(1, this.onsize);
      }
      inherits(FrameParser, Writable);
  
      // mixin to the `prototype`
      Parser(FrameParser.prototype);
  
      FrameParser.prototype.onsize = function (buf) {
        var size = buf.readUInt8(0);
        this._bytes(size, this.onframe);
      };
  
      FrameParser.prototype.onframe = function (buf) {
        this.emit('frame', buf.toString());
  
        // begin parsing the next "frame"
        this._bytes(1, this.onsize);
      };
  
      it('should emit 1 "frame" event', function (done) {
        var p = new FrameParser();
        var s = 'a string';
        p.on('frame', function (frame) {
          assert.equal(s, frame);
          done();
        });
        p.write(new Buffer([ s.length ]));
        p.write(new Buffer(s));
        p.end();
      });
  
      it('should emit 2 "frame" events', function (done) {
        var p = new FrameParser();
        var s = 'a string';
        var s2 = 'done';
        var count = 0;
        p.on('frame', function (frame) {
          count++;
          if (s2 == frame) {
            assert.equal(2, count);
            done();
          }
        });
        p.write(new Buffer([ s.length ]));
        p.write(new Buffer(s));
        p.write(new Buffer([ s2.length ]));
        p.write(new Buffer(s2));
        p.end();
      });
  
    });
  
  });