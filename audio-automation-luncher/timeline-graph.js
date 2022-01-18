 /*
  *  Copyright (c) 2021 DIREKTSPEED <frank@lemanschik.com>. All Rights Reserved.
  *
  *  Use of this source code is governed by a BSD-style license
  *  that can be found in the LICENSE file in the root of the source
  *  tree.
  */
 // taken from chrome://webrtc-internals with jshint adaptions
 
 /* exported TimelineDataSeries, TimelineGraphView */
 
 // The maximum number of data points bufferred for each stats. Old data points
 // will be shifted out when the buffer is full.
 const MAX_STATS_DATA_POINT_BUFFER_SIZE = 1000;

 /**
  * A single point in a data series.  Each point has a time, in the form of
  * milliseconds since the Unix epoch, and a numeric value.
  * @constructor
  * @param {Date} time
  * @param {any} value
  */
class DataPoint {
  constructor(/** @type {Date} */ date, /** @type {*} */ value) {
    this.time = date;
    this.value = value;
  }
};


class TimelineDataSeries {
  constructor() {
    // List of DataPoints in chronological order.
    /** @type {DataPoint[]} */
    this.dataPoints_ = [];

    // Default color.  Should always be overridden prior to display.
    this.color_ = 'red';
    // Whether or not the data series should be drawn.
    this.isVisible_ = true;
    /** @type {number|null} */
    this.cacheStartTime_ = null;
    this.cacheStepSize_ = 0;
    /** @type {*} */
    this.cacheValues_ = [];
  }
  toJSON() {
      if (this.dataPoints_.length < 1) {
        return {};
      }

      let values = [];
      for (let i = 0; i < this.dataPoints_.length; ++i) {
        values.push(this.dataPoints_[i].value);
      }
      return {
        startTime: this.dataPoints_[0].time,
        endTime: this.dataPoints_[this.dataPoints_.length - 1].time,
        values: JSON.stringify(values),
      };
    }

    /**
     * Adds a DataPoint to |this| with the specified time and value.
     * DataPoints are assumed to be received in chronological order.
     * @param {Date} date 
     * @param {*} value 
     */
    addPoint(date, value) {
      this.dataPoints_.push(new DataPoint(date, value));

      if (this.dataPoints_.length > MAX_STATS_DATA_POINT_BUFFER_SIZE) {
        this.dataPoints_.shift();
      }
    }

    isVisible() {
      return this.isVisible_;
    }

    show(isVisible=false) {
      this.isVisible_ = isVisible;
    }

    getColor() {
      return this.color_;
    }

    setColor(color='red') {
      this.color_ = color;
    }

    getCount() {
      return this.dataPoints_.length;
    }
    /**
     * Returns a list containing the values of the data series at |count|
     * points, starting at |startTime|, and |stepSize| milliseconds apart.
     * Caches values, so showing/hiding individual data series is fast.
     * @param {*} startTime 
     * @param {*} stepSize 
     * @param {*} count 
     * @returns 
     */
    getValues(startTime, stepSize, count) {
      // Use cached values, if we can.
      if (this.cacheStartTime_ === startTime &&
        this.cacheStepSize_ === stepSize &&
        this.cacheValues_.length === count) {
        return this.cacheValues_;
      }

      // Do all the work.
      this.cacheValues_ = this.getValuesInternal_(startTime, stepSize, count);
      this.cacheStartTime_ = startTime;
      this.cacheStepSize_ = stepSize;

      return this.cacheValues_;
    }

    /**
     * Returns the cached |values| in the specified time period.
     */
    getValuesInternal_(/** @type {any} */ startTime, /** @type {any} */ stepSize, /** @type {number} */ count) {
      let values = [];
      let nextPoint = 0;
      let currentValue = 0;
      let time = startTime;
      for (let i = 0; i < count; ++i) {
        while (nextPoint < this.dataPoints_.length &&
        this.dataPoints_[nextPoint].time < time) {
          currentValue = this.dataPoints_[nextPoint].value;
          ++nextPoint;
        }
        values[i] = currentValue;
        time += stepSize;
      }
      return values;
    }
 }

 let MAX_VERTICAL_LABELS = 6; // Maximum number of labels placed vertically along the sides of the graph.
 let LABEL_HORIZONTAL_SPACING = 3; // Horizontal spacing between vertically placed labels and the edges of the graph.
 // Horizintal spacing between two horitonally placed labels along the bottom of the graph.
 // var LABEL_LABEL_HORIZONTAL_SPACING = 25;

 let Y_AXIS_TICK_LENGTH = 10; // Length of ticks, in pixels, next to y-axis labels.  The x-axis only has one set of labels, so it can use lines instead.

 let MAX_DECIMAL_PRECISION = 3;


 // shared
 let LABEL_VERTICAL_SPACING = 4; // Vertical spacing between labels and between the graph and labels  
  
 let GRID_COLOR = '#CCC';
 let TEXT_COLOR = '#000';
 let BACKGROUND_COLOR = '#FFF';
/**
  * A Graph is responsible for drawing all the TimelineDataSeries that have
  * the same data type.  Graphs are responsible for scaling the values, laying
  * out labels, and drawing both labels and lines for its data series.
  */
 class Graph {
    constructor() {
      /** @type {any[]} */
      this.dataSeries_ = [];

      // Cached properties of the graph, set in layout.
      this.width_ = 0;
      this.height_ = 0;
      this.fontHeight_ = 0;
      this.startTime_ = 0;
      this.scale_ = 0;

      // The lowest/highest values adjusted by the vertical label step size
      // in the displayed range of the graph. Used for scaling and setting
      // labels.  Set in layoutLabels.
      this.min_ = 0;
      this.max_ = 0;

      // Cached text of equally spaced labels.  Set in layoutLabels.
      /**
         * @type {any[]}
         */
      this.labels_ = [];
    }
  
      addDataSeries(/** @type {any} */ dataSeries) {
        this.dataSeries_.push(dataSeries);
      }

      hasDataSeries(/** @type {any} */ dataSeries) {
        for (let i = 0; i < this.dataSeries_.length; ++i) {
          if (this.dataSeries_[i] === dataSeries) {
            return true;
          }
        }
        return false;
      }

      /**
       * Returns a list of all the values that should be displayed for a given
       * data series, using the current graph layout.
       */
      /**
       * 
       * @param {{isVisible: () => any; getValues: (arg0: number, arg1: number, arg2: number) => any; }} dataSeries 
       * @returns 
       */
      getValues(dataSeries) {
        if (!dataSeries.isVisible()) {
          return null;
        }
        return dataSeries.getValues(this.startTime_, this.scale_, this.width_);
      }


      /**
       * Updates the graph's layout.  In particular, both the max value and
       * label positions are updated.  Must be called before calling any of the
       * drawing functions.
       * @param {number} width 
       * @param {number} height 
       * @param {number} fontHeight 
       * @param {number} startTime 
       * @param {number} scale 
       */
      layout(width, height, fontHeight, startTime, scale) {
        this.width_ = width;
        this.height_ = height;
        this.fontHeight_ = fontHeight;
        this.startTime_ = startTime;
        this.scale_ = scale;

        // Find largest value.
        let max = 0;
        let min = 0;
        for (let i = 0; i < this.dataSeries_.length; ++i) {
          let values = this.getValues(this.dataSeries_[i]);
          if (!values) {
            continue;
          }
          for (let j = 0; j < values.length; ++j) {
            if (values[j] > max) {
              max = values[j];
            } else if (values[j] < min) {
              min = values[j];
            }
          }
        }

        this.layoutLabels_(min, max);
      }

      /**
       * Lays out labels and sets |max_|/|min_|, taking the time units into
       * consideration.  |maxValue| is the actual maximum value, and
       * |max_| will be set to the value of the largest label, which
       * will be at least |maxValue|. Similar for |min_|.
       */
      layoutLabels_(/** @type {number} */ minValue, /** @type {number} */ maxValue) {
        if (maxValue - minValue < 1024) {
          this.layoutLabelsBasic_(minValue, maxValue, MAX_DECIMAL_PRECISION);
          return;
        }

        // Find appropriate units to use.
        let units = ['', 'k', 'M', 'G', 'T', 'P'];
        // Units to use for labels.  0 is '1', 1 is K, etc.
        // We start with 1, and work our way up.
        let unit = 1;
        minValue /= 1024;
        maxValue /= 1024;
        while (units[unit + 1] && maxValue - minValue >= 1024) {
          minValue /= 1024;
          maxValue /= 1024;
          ++unit;
        }

        // Calculate labels.
        this.layoutLabelsBasic_(minValue, maxValue, MAX_DECIMAL_PRECISION);

        // Append units to labels.
        for (let i = 0; i < this.labels_.length; ++i) {
          this.labels_[i] += ' ' + units[unit];
        }

        // Convert |min_|/|max_| back to unit '1'.
        this.min_ *= Math.pow(1024, unit);
        this.max_ *= Math.pow(1024, unit);
      }

      /**
       * Same as layoutLabels_, but ignores units.  |maxDecimalDigits| is the
       * maximum number of decimal digits allowed.  The minimum allowed
       * difference between two adjacent labels is 10^-|maxDecimalDigits|.
       */
      layoutLabelsBasic_(/** @type {number} */ minValue, /** @type {number} */ maxValue, /** @type {number} */ maxDecimalDigits) {
        this.labels_ = [];
        let range = maxValue - minValue;
        // No labels if the range is 0.
        if (range === 0) {
          this.min_ = this.max_ = maxValue;
          return;
        }

        // The maximum number of equally spaced labels allowed.  |fontHeight_|
        // is doubled because the top two labels are both drawn in the same
        // gap.
        let minLabelSpacing = 2 * this.fontHeight_ + LABEL_VERTICAL_SPACING;

        // The + 1 is for the top label.
        let maxLabels = 1 + this.height_ / minLabelSpacing;
        if (maxLabels < 2) {
          maxLabels = 2;
        } else if (maxLabels > MAX_VERTICAL_LABELS) {
          maxLabels = MAX_VERTICAL_LABELS;
        }

        // Initial try for step size between conecutive labels.
        let stepSize = Math.pow(10, -maxDecimalDigits);
        // Number of digits to the right of the decimal of |stepSize|.
        // Used for formating label strings.
        let stepSizeDecimalDigits = maxDecimalDigits;

        // Pick a reasonable step size.
        while (true) {
          // If we use a step size of |stepSize| between labels, we'll need:
          //
          // Math.ceil(range / stepSize) + 1
          //
          // labels.  The + 1 is because we need labels at both at 0 and at
          // the top of the graph.

          // Check if we can use steps of size |stepSize|.
          if (Math.ceil(range / stepSize) + 1 <= maxLabels) {
            break;
          }
          // Check |stepSize| * 2.
          if (Math.ceil(range / (stepSize * 2)) + 1 <= maxLabels) {
            stepSize *= 2;
            break;
          }
          // Check |stepSize| * 5.
          if (Math.ceil(range / (stepSize * 5)) + 1 <= maxLabels) {
            stepSize *= 5;
            break;
          }
          stepSize *= 10;
          if (stepSizeDecimalDigits > 0) {
            --stepSizeDecimalDigits;
          }
        }

        // Set the min/max so it's an exact multiple of the chosen step size.
        this.max_ = Math.ceil(maxValue / stepSize) * stepSize;
        this.min_ = Math.floor(minValue / stepSize) * stepSize;

        // Create labels.
        for (let label = this.max_; label >= this.min_; label -= stepSize) {
          this.labels_.push(label.toFixed(stepSizeDecimalDigits));
        }
      }

      /**
       * Draws tick marks for each of the labels in |labels_|.
       */
      drawTicks(/** @type {CanvasRenderingContext2D} */ context) {
        let x1;
        let x2;
        x1 = this.width_ - 1;
        x2 = this.width_ - 1 - Y_AXIS_TICK_LENGTH;

        context.fillStyle = GRID_COLOR;
        context.beginPath();
        for (let i = 1; i < this.labels_.length - 1; ++i) {
          // The rounding is needed to avoid ugly 2-pixel wide anti-aliased
          // lines.
          let y = Math.round(this.height_ * i / (this.labels_.length - 1));
          context.moveTo(x1, y);
          context.lineTo(x2, y);
        }
        context.stroke();
      }

      /**
       * Draws a graph line for each of the data series.
       */
      drawLines(/** @type {CanvasRenderingContext2D} */ context) {
        // Factor by which to scale all values to convert them to a number from
        // 0 to height - 1.
        let scale = 0;
        let bottom = this.height_ - 1;
        if (this.max_) {
          scale = bottom / (this.max_ - this.min_);
        }

        // Draw in reverse order, so earlier data series are drawn on top of
        // subsequent ones.
        for (let i = this.dataSeries_.length - 1; i >= 0; --i) {
          let values = this.getValues(this.dataSeries_[i]);
          if (!values) {
            continue;
          }
          context.strokeStyle = this.dataSeries_[i].getColor();
          context.beginPath();
          for (let x = 0; x < values.length; ++x) {
            // The rounding is needed to avoid ugly 2-pixel wide anti-aliased
            // horizontal lines.
            context.lineTo(
              x, bottom - Math.round((values[x] - this.min_) * scale));
          }
          context.stroke();
        }
      }

      /**
       * Draw labels in |labels_|.
       */
      drawLabels(/** @type {CanvasRenderingContext2D} */ context) {
        if (this.labels_.length === 0) {
          return;
        }
        let x = this.width_ - LABEL_HORIZONTAL_SPACING;

        // Set up the context.
        context.fillStyle = TEXT_COLOR;
        context.textAlign = 'right';

        // Draw top label, which is the only one that appears below its tick
        // mark.
        context.textBaseline = 'top';
        context.fillText(this.labels_[0], x, 0);

        // Draw all the other labels.
        context.textBaseline = 'bottom';
        let step = (this.height_ - 1) / (this.labels_.length - 1);
        for (let i = 1; i < this.labels_.length; ++i) {
          context.fillText(this.labels_[i], x, step * i);
        }
      }
 }
 

 class TimelineGraphElement extends HTMLElement {
  constructor() { 
    super();
    this.scrollbar_ = {position_: 0, range_: 0};
    
    // this.innerHTML = `<div class="graph-container" id="audioLevelGraph">
    //   <div>average audio level ([0..1])</div>
    //   <canvas id="audioLevelCanvas"></canvas>
    // </div>`;
    this.graphDiv_ = document.createElement('div');
    this.graphDiv_.className = "graph-container";
    this.graphLabel_ = document.createElement('div');
    this.canvas_ = document.createElement('canvas'); 
    this.graphDiv_.append(this.graphLabel_);
    this.graphDiv_.append(this.canvas_);
    this.append(this.graphDiv_);
    
    this.repaintTimerRunning_ = false;

    // Set the range and scale of the graph.  Times are in milliseconds since
    // the Unix epoch.

    // All measurements we have must be after this time.
    this.startTime_ = 0;
    // The current rightmost position of the graph is always at most this.
    this.endTime_ = 1;

    // @ts-ignore
    this.graph_ = new Graph();
    this.scale_ = 1000; // Horizontal scale factor, in terms of milliseconds per pixel.
  }
  static get observedAttributes() { return ['label']; }
  attributeChangedCallback(/** name, oldValue, newValue **/) {
    this.graphLabel_.innerText = this.getAttribute('label') || `label=''`;
  }
  connectedCallback() {
    if (!this.getAttribute('label')) { this.setAttribute('label', 'average audio level ([0..1])'); }
    this.graphLabel_.innerText = this.getAttribute('label') || `label=''`;
    this.updateScrollbarRange_(true);         // Initialize the scrollbar.
  }
  
  setScale(/** @type {number} */ scale) {
    this.scale_ = scale;
  }

  // Returns the total length of the graph, in pixels.
  getLength_() {
    let timeRange = this.endTime_ - this.startTime_;
    // Math.floor is used to ignore the last partial area, of length less
    // than this.scale_.
    return Math.floor(timeRange / this.scale_);
  }

  /**
   * Returns true if the graph is scrolled all the way to the right.
   */
  graphScrolledToRightEdge_() {
    return this.scrollbar_.position_ === this.scrollbar_.range_;
  }

  /**
   * Update the range of the scrollbar.  If |resetPosition| is true, also
   * sets the slider to point at the rightmost position and triggers a
   * repaint.
   */
  updateScrollbarRange_(/** @type {boolean} */ resetPosition) {
    // @ts-ignore
    let scrollbarRange = this.getLength_() - this.canvas_.width;
    if (scrollbarRange < 0) {
      scrollbarRange = 0;
    }

    // If we've decreased the range to less than the current scroll position,
    // we need to move the scroll position.
    if (this.scrollbar_.position_ > scrollbarRange) {
      resetPosition = true;
    }

    this.scrollbar_.range_ = scrollbarRange;
    if (resetPosition) {
      this.scrollbar_.position_ = scrollbarRange;
      this.repaint();
    }
  }

  /**
   * Sets the date range displayed on the graph, switches to the default
   * scale factor, and moves the scrollbar all the way to the right.
   */
  setDateRange(/** @type {Date} */ startDate, /** @type {Date} */ endDate) {
    this.startTime_ = startDate.getTime();
    this.endTime_ = endDate.getTime();

    // Safety check.
    if (this.endTime_ <= this.startTime_) {
      this.startTime_ = this.endTime_ - 1;
    }

    this.updateScrollbarRange_(true);
  }

  /**
   * Updates the end time at the right of the graph to be the current time.
   * Specifically, updates the scrollbar's range, and if the scrollbar is
   * all the way to the right, keeps it all the way to the right.  Otherwise,
   * leaves the view as-is and doesn't redraw anything.
   */
  updateEndDate(/** @type {number} */ optDate) {
    this.endTime_ = optDate || Date.now();
    this.updateScrollbarRange_(this.graphScrolledToRightEdge_());
  }

  getStartDate() {
    return new Date(this.startTime_);
  }

  /**
   * Replaces the current TimelineDataSeries with |dataSeries|.
   */
  setDataSeries(/** @type {string | any[]} */ dataSeries) {
    // Simply recreates the Graph.
    this.graph_ = new Graph();
    for (let i = 0; i < dataSeries.length; ++i) {
      this.graph_.addDataSeries(dataSeries[i]);
    }
    this.repaint();
  }

  /**
   * Adds |dataSeries| to the current graph.
   */
  addDataSeries(/** @type {any} */ dataSeries) {
    if (!this.graph_) {
      this.graph_ = new Graph();
    }
    this.graph_.addDataSeries(dataSeries);
    this.repaint();
  }
  /** Draws the graph on |canvas_|. */
  repaint() {
    this.repaintTimerRunning_ = false;
    
    // @ts-ignore
    let width =  this.canvas_.width;
    // @ts-ignore
    let height = this.canvas_.height;
    // @ts-ignore
    const context = this.canvas_.getContext('2d');
    if (!context) { return; }
    // Clear the canvas.
    context.fillStyle = BACKGROUND_COLOR;
    context.fillRect(0, 0, width, height);

    // @ts-ignore // Try to get font height in pixels.  Needed for layout. 
    let fontHeightString = context.font.match(/([0-9]+)px/)[1];
    let fontHeight = parseInt(fontHeightString);

    // Safety check, to avoid drawing anything too ugly.
    if (fontHeightString.length === 0 || fontHeight <= 0 ||
      fontHeight * 4 > height || width < 50) {
      return;
    }

    // Save current transformation matrix so we can restore it later.
    context.save();

    // The center of an HTML canvas pixel is technically at (0.5, 0.5).  This
    // makes near straight lines look bad, due to anti-aliasing.  This
    // translation reduces the problem a little.
    context.translate(0.5, 0.5);

    // Figure out what time values to display.
    let position = this.scrollbar_.position_;
    // If the entire time range is being displayed, align the right edge of
    // the graph to the end of the time range.
    if (this.scrollbar_.range_ === 0) {
      // @ts-ignore
      position = this.getLength_() - this.canvas_.width;
    }
    let visibleStartTime = this.startTime_ + position * this.scale_;

    // Make space at the bottom of the graph for the time labels, and then
    // draw the labels.
    let textHeight = height;
    height -= fontHeight + LABEL_VERTICAL_SPACING;
    this.drawTimeLabels(context, width, height, textHeight, visibleStartTime);

    // Draw outline of the main graph area.
    context.strokeStyle = GRID_COLOR;
    context.strokeRect(0, 0, width - 1, height - 1);

    if (this.graph_) {
      // Layout graph and have them draw their tick marks.
      this.graph_.layout(
        width, height, fontHeight, visibleStartTime, this.scale_);
      this.graph_.drawTicks(context);

      // Draw the lines of all graphs, and then draw their labels.
      this.graph_.drawLines(context);
      this.graph_.drawLabels(context);
    }

    // Restore original transformation matrix.
    context.restore();
  }
  /**
   * 
   * @param {CanvasRenderingContext2D} context 
   * @param {number} width 
   * @param {number} height 
   * @param {number} textHeight 
   * @param {number} startTime 
   */
  drawTimeLabels(context, width, height, textHeight, startTime) {
    // Draw the labels 1 minute apart.
    let timeStep = 1000 * 60;

    // Find the time for the first label.  This time is a perfect multiple of
    // timeStep because of how UTC times work.
    let time = Math.ceil(startTime / timeStep) * timeStep;

    context.textBaseline = 'bottom';
    context.textAlign = 'center';
    context.fillStyle = TEXT_COLOR;
    context.strokeStyle = GRID_COLOR;

    // Draw labels and vertical grid lines.
    while (true) {
      let x = Math.round((time - startTime) / this.scale_);
      if (x >= width) {
        break;
      }
      let text = (new Date(time)).toLocaleTimeString();
      context.fillText(text, x, textHeight);
      context.beginPath();
      context.lineTo(x, 0);
      context.lineTo(x, height);
      context.stroke();
      time += timeStep;
    }
  }

  getDataSeriesCount() {
    if (this.graph_) {
      return this.graph_.dataSeries_.length;
    }
    return 0;
  }

  hasDataSeries(/** @type {any} */ dataSeries) {
    if (this.graph_) {
      return this.graph_.hasDataSeries(dataSeries);
    }
    return false;
  }
}
customElements.define('timeline-graph-element', TimelineGraphElement);



  // Init Audio 


const initReceiverStats = (/** @type {RTCPeerConnection} */ peerConnection) => {
  if (!window.RTCRtpReceiver || !('getSynchronizationSources' in window.RTCRtpReceiver.prototype)) { return ()=>{}};
  let lastTime = 0;
  /** @type {number[]} */
  const audioLevels = [];
  const audioLevelSeries = new TimelineDataSeries(); 
  const audioLevelGraph = new TimelineGraphElement(); // new TimelineGraphView('audioLevelGraph', 'audioLevelCanvas');
  audioLevelGraph.setAttribute('label','average audio level ([0..1])');
  

  audioLevelGraph.updateEndDate();  
  let closed = false;
  const getAudioLevel = (timestamp = 0) => {
      if (closed) { return; }
      window.requestAnimationFrame(getAudioLevel);
      if (!peerConnection) { return; }
      const receiver = peerConnection.getReceivers().find((rtcRtpReceiver) => rtcRtpReceiver.track.kind === 'audio');
      if (!receiver) { return; }
      const sources = receiver.getSynchronizationSources();
      sources.forEach(( source) => source.audioLevel ? audioLevels.push(source.audioLevel) : undefined ); 
      
      if (!lastTime) { 
        lastTime = timestamp; 
      } else if (timestamp - lastTime > 500 && audioLevels.length > 0) {   // Update graph every 500ms.
        const maxAudioLevel = Math.max.apply(null, audioLevels);
        audioLevelSeries.addPoint(new Date(), maxAudioLevel);
        audioLevelGraph.setDataSeries([audioLevelSeries]);
        audioLevelGraph.updateEndDate();
        audioLevels.length = 0;
        lastTime = timestamp;
      }
  };
  window.requestAnimationFrame(getAudioLevel);
  return () => closed = true;
};

class SenderStatsElement extends HTMLElement {
  constructor() {
    super();
    this.bitrateSeries = new TimelineDataSeries();
    this.bitrateGraph = new TimelineGraphElement();
    this.bitrateGraph.setAttribute('label','Bitrate');
    this.bitrateGraph.updateEndDate();
  
    this.targetBitrateSeries = new TimelineDataSeries();
    this.targetBitrateSeries.setColor('blue');
  
    this.headerrateSeries = new TimelineDataSeries();
    this.headerrateSeries.setColor('green');
  
    this.packetSeries = new TimelineDataSeries();
    this.packetGraph = new TimelineGraphElement();
    this.packetGraph.setAttribute('label','Packets sent per second');
    
  }
  connectedCallback() {}
  initWith(/** @type {RTCPeerConnection} */ peerConnection) {
    this.peerConnection = peerConnection;
    /** @type {RTCStatsReport} */
    this.lastResult;      
    const senderStats = () => {
      if (!peerConnection) { return; }
      const sender = peerConnection.getSenders()[0];
      if (!sender) { return; };
      sender.getStats().then(this.addStatsToGraph);
    };
    this.packetGraph.updateEndDate();
    this.interval = window.setInterval(senderStats, 1000);
    
  }
  disconnectedCallback() {
    window.clearInterval(this.interval)
  }
  addStatsToGraph(/** @type {RTCStatsReport} */reports) {
    const { lastResult } = this;
    reports.forEach((report) => {
      if (report.type === 'outbound-rtp' && !report.isRemote) {
        const { timestamp, bytesSent, headerBytesSent, packetsSent } = report;
        //console.log({ timestamp, bytesSent, headerBytesSent, packetsSent })
        if (lastResult && lastResult.has(report.id)) {
          const deltaT = (timestamp - lastResult.get(report.id).timestamp) / 1000;
          // calculate bitrate
          const bitrate = 8 * (bytesSent - lastResult.get(report.id).bytesSent) / deltaT;
          const headerrate = 8 * (headerBytesSent - lastResult.get(report.id).headerBytesSent) / deltaT;

          // append to chart
          this.bitrateSeries.addPoint(timestamp, bitrate);
          this.headerrateSeries.addPoint(timestamp, headerrate);
          this.targetBitrateSeries.addPoint(timestamp, report.targetBitrate);
          this.bitrateGraph.setDataSeries([this.bitrateSeries, this.headerrateSeries, this.targetBitrateSeries]);
          this.bitrateGraph.updateEndDate();

          // calculate number of packets and append to chart
          this.packetSeries.addPoint(timestamp, (packetsSent - lastResult.get(report.id).packetsSent) / deltaT);
          this.packetGraph.setDataSeries([this.packetSeries]);
          this.packetGraph.updateEndDate();
        }
      }
    });
    this.lastResult = reports;
  }
}

const initSenderStats = (/** @type {RTCPeerConnection} */ peerConnection) => {
      
  const bitrateSeries = new TimelineDataSeries();
  const bitrateGraph = new TimelineGraphElement();
  bitrateGraph.setAttribute('label','Bitrate');
  bitrateGraph.updateEndDate();

  const targetBitrateSeries = new TimelineDataSeries();
  targetBitrateSeries.setColor('blue');

  const headerrateSeries = new TimelineDataSeries();
  headerrateSeries.setColor('green');

  const packetSeries = new TimelineDataSeries();
  const packetGraph = new TimelineGraphElement();
  packetGraph.setAttribute('label','Packets sent per second');
  
  packetGraph.updateEndDate();
  
  /** @type {RTCStatsReport} */
  let lastResult;      
  
  const addStatsToGraph = (/** @type {RTCStatsReport} */reports) => {
    reports.forEach((report) => {
      if (report.type === 'outbound-rtp' && !report.isRemote) {
        const { timestamp, bytesSent, headerBytesSent, packetsSent } = report;
        //console.log({ timestamp, bytesSent, headerBytesSent, packetsSent })
        if (lastResult && lastResult.has(report.id)) {
          const deltaT = (timestamp - lastResult.get(report.id).timestamp) / 1000;
          // calculate bitrate
          const bitrate = 8 * (bytesSent - lastResult.get(report.id).bytesSent) / deltaT;
          const headerrate = 8 * (headerBytesSent - lastResult.get(report.id).headerBytesSent) / deltaT;

          // append to chart
          bitrateSeries.addPoint(timestamp, bitrate);
          headerrateSeries.addPoint(timestamp, headerrate);
          targetBitrateSeries.addPoint(timestamp, report.targetBitrate);
          bitrateGraph.setDataSeries([bitrateSeries, headerrateSeries, targetBitrateSeries]);
          bitrateGraph.updateEndDate();

          // calculate number of packets and append to chart
          packetSeries.addPoint(timestamp, (packetsSent - lastResult.get(report.id).packetsSent) / deltaT);
          packetGraph.setDataSeries([packetSeries]);
          packetGraph.updateEndDate();
        }
      }
    });
    lastResult = reports;
  };
  
  const senderStats = () => {
    if (!peerConnection) { return; }
    const sender = peerConnection.getSenders()[0];
    if (!sender) { return; };
    sender.getStats().then(addStatsToGraph);
  };

  const interval = window.setInterval(senderStats, 1000);
  return () => window.clearInterval(interval);
}

export { initSenderStats, initReceiverStats };