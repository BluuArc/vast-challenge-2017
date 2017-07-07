`use strict`;

var tooltip = tooltip || new Tooltip();

let TimeSlider = function(options){
    options = options || {};
    let self = this;
    let w = 800, h = 50;
    let padding = 25;
    let svg = d3.select('#timestamp-brush-slider').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);
    let scales = {};
    let lines = [];
    let selectedSensor = 'sensor1';
    let verbose = options.verbose || false;

    function drawPointAt(x, y) {
        if (x instanceof Vector) {
            y = x.y;
            x = x.x;
        }

        return svg.append('circle')
            .attr('r', 5)
            .attr('cx', x)
            .attr('cy', y);
    }

    //empty message removes events
    function setTooltipEvents(target, message) {
        if (!message || message.length === 0) {
            target.on('mouseenter', undefined)
                .on('mouseleave', undefined);
        } else {
            target.on('mouseenter', function () {
                tooltip.setContent(message);
                tooltip.showAt(d3.event.pageX, d3.event.pageY);
            }).on('mouseleave', function () {
                tooltip.hide();
            });
        }
    }

    self.init = function(options){
        scales = options.scales || scales;

        let svgRange = {
            x: [padding, w-padding],
            y: [padding, h-padding]
        };

        let monthScales = {};
        monthScales['April 2016'] = d3.scaleTime()
            .domain([new Date(2016,3,1), new Date(new Date(2016,4,1)-1)])
            .range([padding,(w/3)-padding]);
        monthScales['August 2016'] = d3.scaleTime()
            .domain([new Date(2016, 7, 1), new Date(new Date(2016, 8, 1) - 1)])
            .range([(w/3)-padding, (2*w/3)-padding]);
        monthScales['December 2016'] = d3.scaleTime()
            .domain([new Date(2016,11,1), new Date(new Date(2016,0,1)-1)])
            .range([(2*w/3)-padding(w-padding)]);

        scales.monthScales = monthScales;
    }


    
}