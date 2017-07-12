`use strict`;

var tooltip = tooltip || new Tooltip();

let ChemicalOverviewChart = function(options){
    options = options || {};
    let self = this;
    let verbose = options.verbose || false;
    let w = 400, h = 400;
    let padding = 30;
    let paddingLeft = 45, paddingRight = padding - paddingLeft;
    const chemical_names = ['Appluimonia', 'Chlorodinine', 'Methylosmolene', 'AGOC-3A'];
    let graphPadding = 10;
    let graphSize = (h-padding)/chemical_names.length - graphPadding;
    let graphs = [];
    let selectedSensor = 'sensor1';

    let svg = d3.select('#overview-graph').append('svg').classed('svg-content', true)
        .attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', `xMinYMin meet`);

    let axes = {}, scales = {};

    let line = d3.line()
        .x((d) => { return d.x; }).y((d) => { return d.y; });

    //based off of https://bl.ocks.org/mbostock/34f08d5e11952a80609169b7917d4172
    self.init = function(options){
        console.log("received",options);
        let svgRange = {
            x: d3.scaleLinear().range([padding, w-padding]),
            y: d3.scaleLinear().range([padding, h-padding])
        };

        //create stacking scales from top to bottom
        for(let c of chemical_names){
            scales[c] = d3.scaleLinear().domain(options.scales[c].domain())
                .range([graphSize, 0]);
        }

        scales.x = d3.scaleTime().range(svgRange.x.range());
        scales.svgRange = svgRange; //can be used for debugging

        svg.append('text')
            .text("Chemical Reading Overview")
            .attr('text-anchor','middle').classed('graph-title',true)
            .attr('x',w/2).attr('y',padding);

        drawAxes(options.statistics);

        updateTimeScale("4/1/16 0:00", "4/2/16 0:00");
        console.log(scales);
    };

    function drawAxes(statistics){
        let group = svg.append('g').classed('overview-axes',true);
        axes.x = d3.axisBottom(scales.x).ticks(5);
        let defaultTickFormat = axes.x.tickFormat();
        
        //create axes for each graph
        let top = padding/2; //top of each graph
        for(let c of chemical_names){
            axes[c] = d3.axisLeft(scales[c]).tickValues(((range) => {
                return [range[0], (range[0]+range[1])/2, range[1]];
            })(scales[c].domain()));
            //vertical
            group.append('g').classed('axis',true).attr('id',c)
                .attr('transform',`translate(${paddingLeft-0.5},${top})`)
                .classed('overview-axis',true)
                .call(axes[c]);

            //only label ticks on last graph
            if (chemical_names.indexOf(c) !== chemical_names.length - 1){
                axes[`${c}-horizontal`] = axes.x.tickFormat(() => { return null; } );
            }else{
                axes[`${c}-horizontal`] = axes.x.tickFormat(defaultTickFormat);
            }
            
            //horizontal
            group.append('g').classed('axis', true).attr('id', c)
                .classed('time-axis', true)
                .attr('transform', `translate(${paddingLeft - padding-0.5},${top + graphSize})`)
                .classed('overview-axis', true)
                .call(axes[`${c}-horizontal`]);

            //chemical label
            let label = svg.append('text').classed('axis-label',true).classed(c,true).classed('overview-axis',true)
                .attr('text-anchor','middle').attr('transform',`translate(${(paddingLeft-padding)},${top+graphSize/2}) rotate(-90)`)
                .text(`${c} (ppm)`);
            let content = `<b>Overall Minimum:</b> ${statistics[c].min} ppm at <i>${statistics[c].minTimeStamp}</i>`;
            content += `<br><b>Overall Maximum:</b> ${statistics[c].max} ppm at <i>${statistics[c].maxTimeStamp}</i>`;
            content += `<br>Note that these values don't consider any erroneous values.`;
            tooltip.setEvents(label, content);
            top += graphSize + graphPadding;
        }
        console.log(axes);

    }

    function updateTimeScale(start,end){
        if(!scales.x) return;
        console.log("update time scale",start,end);
        let start_time = new Date(start);
        let end_time = new Date(end);
        scales.x.domain([start_time,end_time]);
        let defaultTickFormat = axes.x.tickFormat();
        for(let c of chemical_names){
            //only label ticks on last graph
            if (chemical_names.indexOf(c) !== chemical_names.length - 1) {
                axes[`${c}-horizontal`] = axes.x.tickFormat(() => { return null; });
            } else {
                axes[`${c}-horizontal`] = axes.x.tickFormat(defaultTickFormat);
            }
            svg.select(`.time-axis#${c}`).call(axes[`${c}-horizontal`]);
        }
    }
    
    self.update = function(start,end,sensor,data){
        console.log("entered overview chart update",start,end,data);

        if(sensor && sensor !== selectedSensor){
            selectedSensor = sensor;
            console.log("updating sensor to",selectedSensor);
            svg.selectAll('.overview-path').classed('inactive',true);
            svg.selectAll('.overview-notification').classed('inactive',true);
            svg.selectAll(`#${selectedSensor}`).classed('inactive',false).raise();
        }

        if(start && end){
            updateTimeScale(start, end);
            let start_time = new Date(start);
            let end_time = new Date(end);
            //filter out data out of range
            let timestamps = Object.keys(data).filter((d) => {
                let date = new Date(d);
                return date >= start_time && date <= end_time;   
            }).sort((a,b) => { 
                return new Date(a) - new Date(b); 
            });

            console.log("Filtered timestamps",timestamps);

            //array of paths
            let paths = {
                'Appluimonia': {},
                'Chlorodinine': {},
                'Methylosmolene': {},
                'AGOC-3A': {},  
            }; 
            //array of points
            let erroneous = {
                'Appluimonia': {},
                'Chlorodinine': {},
                'Methylosmolene': {},
                'AGOC-3A': {},
            };
            //array of points; each array is one path
            let tempPaths = {
                'Appluimonia': {},
                'Chlorodinine': {},
                'Methylosmolene': {},
                'AGOC-3A': {},
            };
            for(let c in tempPaths){
                for (let i = 1; i <= 9; ++i) {
                    tempPaths[c][`sensor${i}`] = [];
                }
            }
            
            //create path points
            for(let t of timestamps){
                for(let s in data[t]){
                    for(let c in data[t][s]){
                        let readings = data[t][s][c];
                        let offset = padding / 2 + (chemical_names.indexOf(c)) * graphSize + (chemical_names.indexOf(c)) * graphPadding;
                        // console.log(c);
                        if(readings.length === 1){
                            tempPaths[c][s].push({
                                reading: readings[0],
                                timestamp: t,
                                scaledReading: scales[c](readings[0]) + offset,
                                scaledTime: scales.x(new Date(t)) + (paddingLeft-padding)
                            });
                        }else{ //erroneous
                            if (!erroneous[c][s]){
                                erroneous[c][s] = [];
                            }
                            erroneous[c][s].push(t);

                            //push current stuff and reset array, if necessary
                            if(!paths[c][s]){
                                paths[c][s] = [];
                            }
                            if(tempPaths[c][s].length > 1){
                                paths[c][s].push(tempPaths[c][s]);
                                tempPaths[c][s] = [];
                            }
                        }
                    }
                }
            }
            //push any remaining data
            for(let c in tempPaths){
                for(let s in tempPaths[c]){
                    if (!paths[c][s]) {
                        paths[c][s] = [];
                    }
                    if(tempPaths[c][s].length > 1){
                        paths[c][s].push(tempPaths[c][s]);
                    }
                }
            }

            console.log(paths);

            //plot chemical data
            svg.selectAll('.overview-path').remove();
            svg.selectAll('.overview-notification').remove();
            // let c = 'Appluimonia';
            for(let c in paths){
                for(let s in paths[c]){
                    for(let p of paths[c][s]){ //for every path
                        let points = p.map((d) => { return new Vector(d.scaledTime,d.scaledReading)});
                        console.log("points for",s,points)
                        svg.append('path').datum(points)
                            .classed('overview-path',true)
                            .attr('id',s).classed(c,true)
                            .classed('inactive', s !== selectedSensor)
                            .attr('d',line);
                    }
                }

                for(let s in erroneous[c]){
                    console.log(c,s,erroneous[c][s]);
                    let [min,max] = scales[c].range();
                    let offset = padding / 2 + (chemical_names.indexOf(c)) * graphSize + (chemical_names.indexOf(c))*graphPadding;
                    [min,max] = [min+offset,max+offset]
                    console.log(c, scales[c].domain(),scales[c].range());
                    for(let dataPoint of erroneous[c][s]){
                        let xPos = scales.x(new Date(dataPoint)) + (paddingLeft - padding)
                        let notification = svg.append('path').classed('overview-notification', true)
                            .attr('id', s).classed('inactive', s !== selectedSensor)
                            .datum([new Vector(xPos, max), new Vector(xPos, min)])
                            .attr('d', line);
                        tooltip.setEvents(notification, `${s} has an erroneous reading at ${dataPoint}`);
                    }
                }
            }
            svg.selectAll(`#${selectedSensor}`).raise();
        }
        
    }

    function updateTimeSelector(time_stamp){
        console.log("updateTimeSelector",time_stamp);
        let xPos = scales.x(new Date(time_stamp)) + (paddingLeft-padding);
        svg.selectAll('.timestamp-indicator').remove();
        svg.append('path').classed('timestamp-indicator', true)
            .datum([new Vector(xPos, graphPadding), new Vector(xPos, (h - padding)+5)])
            .attr('d', line);
    }
    self.updateTimeSelector = updateTimeSelector;

}
