/**
 * Copyright (C) 2016-2018 Emanuel Gafton, NOT/ING.
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version. See COPYING.md.
 */

function TargetList() {
    this.nTargets = 0;
    this.Targets = [];
    this.Offline = [];
    this.InputText = null;
    this.VisibleLines = null;   // including empty lines and comments
    this.TargetsLines = null;   // only the lines that contain proper targets
    this.FormattedLines = null; // contains arrays or null values
    this.TCSlines = null;
    this.MaxLen = null;
    this.InputStats = null;
    this.InputValid = false;
    this.ComputedTargets = null;
    this.BadWolfStart = [];
    this.BadWolfEnd = [];
    this.StartingAt = null;
    this.Warning1 = [];
    this.Warning2 = [];
}

function Target(k, obj) {
    this.Index = k;
    this.Name = obj.name;
    this.RA = obj.ra;
    this.Dec = obj.dec;
    this.Epoch = obj.epoch;
    this.shortRA = (obj.ra.indexOf('.') > -1) ? obj.ra.substr(0, obj.ra.indexOf('.')) : obj.ra;
    this.shortDec = (obj.dec.indexOf('.') > -1) ? obj.dec.substr(0, obj.dec.indexOf('.')) : obj.dec;
    this.J2000 = obj.J2000;
    this.Exptime = obj.exptime;
    this.ExptimeSeconds = Math.round(this.Exptime * 86400);
    this.Exptime = Math.floor(this.Exptime / driver.night.xstep) * driver.night.xstep;
    var hrs = Math.floor(this.ExptimeSeconds / 3600);
    var min = Math.round((this.ExptimeSeconds - hrs * 3600) / 60);
    this.ExptimeHM = (hrs > 0 ? hrs.toFixed(0) + 'h ' : '') + min.toFixed(0) + 'm';
    this.ZenithTime = obj.zenithtime;
    this.Graph = obj.line;
    this.FullType = obj.type;
    this.Type = (obj.type.indexOf('/') === -1 ? obj.type : obj.type.substring(0, obj.type.indexOf('/')));
    this.AvgMoonDistance = Math.round(obj.mdist);
    this.ProjectNumber = obj.project;
    this.RestrictionMaxAlt = $('#opt_away_from_zenith').is(':checked') ? 88 : 90;
    this.MaxAirmass = obj.airmass;
    this.RestrictionMinAlt = helper.AirmassToAltitude(this.MaxAirmass);
    this.RestrictionMinUT = obj.UTstart; //night.ENauTwilight;
    this.RestrictionMaxUT = obj.UTend;   //night.MNauTwilight;
    this.observable = [];
    this.Scheduled = false;
    this.FillSlot = obj.fillslot;
    this.Constraints = obj.constraints;
    this.inputRA = obj.inputRA;
    this.inputDec = obj.inputDec;
    if (this.FillSlot) {
        helper.LogEntry('Attention: object <i>' + this.Name + '</i> will fill its entire time slot.');
    }
    if ($('#opt_id_next_line').is(':checked')) {
        this.LabelFillColor = Driver.FillColors[this.Type];
        this.LabelTextColor = Driver.TextColors[this.Type];
        this.LabelStrokeColor = this.LabelFillColor;
    } else {
        this.LabelFillColor = 'white';
        this.LabelTextColor = Driver.FillColors[this.Type] == 'blue' ? 'blue' : 'black';
        this.LabelStrokeColor = Driver.FillColors[this.Type];
    }
    this.Observed = false;
    this.ObservedStartTime = null;
    this.ObservedEndTime = null;
    this.ObservedTotalTime = null;
    this.ReconstructedInput = this.Name + ' ' + this.inputRA + ' ' + this.inputDec + ' ' + this.Epoch + ' ' + this.ExptimeSeconds + ' ' + this.ProjectNumber + ' ' + this.Constraints + ' ' + this.FullType;
    this.ReconstructedMinimumInput = this.Name + ' ' + this.inputRA + ' ' + this.inputDec + ' ' + this.Epoch;
    this.ExtraInfo = null;
    this.BacklinkToOBQueue = null;
    this.Comments = null;
};

TargetList.prototype.targetStringToJSON = function (line) {
    var night = driver.night;
    dat = line.split(/\s+/);
    rax = dat[3].split('/');
    decx = dat[6]. split('/');
    ra = sla.dtf2r(parseInt(dat[1]), parseInt(dat[2]), parseFloat(rax[0]));
    decdeg = Math.abs(parseInt(dat[4]));
    decneg = dat[4].substring(0, 1) === '-';
    dec = sla.daf2r(decdeg, parseInt(dat[5]), parseFloat(decx[0]));
    if (decneg) {
        dec *= -1;
    }
    var pmra, pmdec;
    if (rax.length === 1) {
        pmra = 0;
    } else {
        // Given in arcsec/year;
        // convert to radians/year
        pmra = parseFloat(rax[1]) * sla.das2r;
        // Remove the cos(dec) for SLALIB
        pmra = pmra/Math.cos(dec);
    }
    if (decx.length === 1) {
        pmdec = 0;
    } else {
        // convert to radians/year
        pmdec = parseFloat(decx[1]) * sla.das2r;
    }
    epoch = parseFloat(dat[7]);
    
    var stl = helper.stl(night.utcMidnight, night.eqeqx);
    var ret = sla.mapqk(ra, dec, pmra, pmdec, 0, 0, night.amprms);
    var tsouth = - sla.drange(stl - ret.ra) * sla.r2d / 15;
    console.log(ra,dec,ret,sla.dr2tf(2, sla.dranrm(tsouth)));
    
    var yaxis = [];
    var retap, retob;
    for (i=0; i<night.Nx; i+=1) {
        retap = sla.mapqk(ra, dec, pmra, pmdec, 0, 0, night.amprms[i]);
        retob = sla.aopqk(retap.ra, retap.da, night.aoprms[i]);
        // Approximate refracted alt
        ell = 0.5*Math.PI - sla.refz(0.5*Math.PI-ret.el, night.refa, night.refb);
        yaxis.push(helper.rad2deg(ell));
    }
    //var alt =
};

TargetList.prototype.setTargets = function (obj) {
    var i, o, res;
    var nobj = obj.length;
    for (i = 0; i < nobj; i += 1) {
        console.log(obj[i]);
        this.targetStringToJSON (obj[i]);
    }
    return;
    this.nTargets = res.len;
    this.Targets = [];
    this.resetWarnings();
    this.processOfflineTime();
    for (i = 0; i < this.nTargets; i += 1) {
        this.Targets[i] = this.processTarget(i, res['object ' + i.toString()], true);
    }
    this.warnUnobservable();
    driver.graph.setTargetsSize(this.nTargets);
    this.removeClusters();
};

TargetList.prototype.addTargets = function (obj) {
    var i, o, res, oldNobjects = this.nTargets;
    var nobj = obj.length;
    for (i = 0; i < nobj; i += 1) {
        console.log(obj[i]);
    }
    return;
    this.nTargets += res.len;
    this.resetWarnings();
    this.processOfflineTime();
    for (i = oldNobjects; i < this.nTargets; i += 1) {
        this.Targets[i] = this.processTarget(i, res['object ' + (i - oldNobjects).toString()], false);
    }
    this.warnUnobservable();
    driver.graph.setTargetsSize(this.nTargets);
};

TargetList.prototype.processTarget = function (i, obj, checkOB) {
    var target = new Target(i, obj);
    target.preCompute();
    target.LabelX = target.ZenithTime;
    if (target.LabelX < driver.night.ENauTwilight) {
        target.LabelX = driver.night.ENauTwilight;
    } else if (target.LabelX > driver.night.MNauTwilight) {
        target.LabelX = driver.night.MNauTwilight;
    }
    target.LabelY = target.getAltitude(target.LabelX);
    //if (checkOB && (driver.obLinks.length === this.nTargets)) {
    if (checkOB && (i < driver.obLinks.length)) {
        target.BacklinkToOBQueue = driver.obLinks[i];
        target.ExtraInfo = driver.obExtraInfo[i];
    }
    target.xlab = driver.graph.transformXLocation(target.LabelX);
    target.ylab = driver.graph.transformYLocation(target.LabelY);
    return target;
};

Target.prototype.intersectingChain = function (Targets, checked) {
    var len, iIntersect = [], i, j, chain = [this.Index], rc;
    if (checked.indexOf(this.Index) > -1) {
        return [];
    }
    if (this.xlab < driver.graph.xstart || this.xlab > driver.graph.xstart + driver.graph.width ||
            this.ylab > driver.graph.yend) {
        return [];
    }
    checked.push(this.Index);
    for (j = 0, len = Targets.length; j < len; j += 1) {
        if (j === this.Index || checked.indexOf(j) > -1) {
            continue;
        }
        if (helper.TwoCirclesIntersect(this.xlab, this.ylab, driver.graph.CircleSize + 0.5, Targets[j].xlab, Targets[j].ylab, driver.graph.CircleSize + 0.5)) {
            iIntersect.push(j);
        }
    }
    for (i in iIntersect) {
        j = iIntersect[i];
        chain = chain.concat(Targets[j].intersectingChain(Targets, checked));
    }
    return chain;
};

TargetList.prototype.removeClusters = function () {
    var checked = [], i, cluster, hasclusters, nIter = 0;
    do {
        hasclusters = false;
        for (i = 0; i < this.nTargets; i += 1) {
            cluster = this.Targets[i].intersectingChain(this.Targets, checked);
            if (cluster.length > 1) {
                hasclusters = true;
                this.spaceOutCluster(cluster);
            }
        }
        nIter += 1;
    } while (hasclusters || nIter < 10);
};

TargetList.prototype.spaceOutCluster = function (cluster) {
    var i, obj, prev;
    for (i = 1; i < cluster.length; i += 1) {
        prev = this.Targets[cluster[i - 1]];
        obj = this.Targets[cluster[i]];
        obj.xlab = Math.max(prev.xlab, obj.xlab);
        do {
            obj.xlab += 1;
            obj.LabelX = driver.graph.reverseTransformXLocation(obj.xlab);
            obj.LabelY = obj.getAltitude(obj.LabelX);
            obj.ylab = driver.graph.transformYLocation(obj.LabelY);
        } while (helper.TwoCirclesIntersect(obj.xlab, obj.ylab, driver.graph.CircleSize + 0.5, prev.xlab, prev.ylab, driver.graph.CircleSize + 0.5));
    }
};

TargetList.prototype.processOfflineTime = function () {
    var i, len = this.BadWolfStart.length;
    this.Offline = [];
    for (i = 0; i < len; i += 1) {
        this.Offline.push({Start: this.BadWolfStart[i], End: this.BadWolfEnd[i]});
    }
};

TargetList.prototype.resetWarnings = function () {
    this.Warning1 = [];
    this.Warning2 = [];
};

TargetList.prototype.warnUnobservable = function () {
    if (this.Warning1.length > 0) {
        helper.LogWarning('Warning: Target' + (this.Warning1.length === 1 ? '' : 's') + ' <i>' + this.Warning1.join(', ') + '</i> cannot possibly be scheduled for this night, as ' + (this.Warning1.length === 1 ? 'it' : 'they') + ' will never fit the airmass/UT constraints.');
    }
    if (this.Warning2.length > 0) {
        helper.LogWarning('Warning: Target' + (this.Warning2.length === 1 ? '' : 's') + ' <i>' + this.Warning2.join(', ') + '</i> cannot possibly be scheduled for this night, as ' + (this.Warning2.length === 1 ? 'it' : 'they') + ' will not fit the airmass/UT constraints for long enough to perform the observations.');
    }
};

TargetList.prototype.plan = function () {
    var scheduleorder = this.schedule_inOrderOfSetting(driver.night.Sunset);
    this.optimize_interchangeNeighbours(scheduleorder);
    this.optimize_moveToLaterTimesIfRising(scheduleorder, true);
    this.optimize_interchangeNeighbours(scheduleorder);
    //this.reorder_accordingToScheduling(scheduleorder);
    this.display_scheduleStatistics();
};

TargetList.prototype.canSchedule = function (obj, start) {
    var end = start + obj.Exptime;
    var overlaps = false, i, other;
    for (i = 0; i < this.nTargets; i += 1) {
        if (i === this.Index) {
            continue;
        }
        other = this.Targets[i];
        if (!other.Scheduled) {
            continue;
        }
        if (end <= other.ScheduledStartTime || start >= other.ScheduledEndTime) {
            continue;
        }
        overlaps = true;
        break;
    }
    if (overlaps) {
        return false;
    }

    for (i = 0; i < obj.nAllowed; i += 1) {
        if (start >= obj.beginAllowed[i] && end <= obj.endAllowed[i]) {
            return true;
        }
    }
    return false;
};

TargetList.prototype.optimize_interchangeNeighbours = function (scheduleorder) {
    var i, obj1, obj2, am1now, am2now, am1if, am2if, exchange, t1, c;
    for (i = 0; i < scheduleorder.length - 1; i += 1) {
        obj1 = this.Targets[scheduleorder[i]];
        obj2 = this.Targets[scheduleorder[i + 1]];
        if (obj1.Observed || obj2.Observed) {
            continue;
        }
        if (obj1.FillSlot || obj2.FillSlot) {
            continue;
        }
        if (this.canSchedule(obj2, obj1.ScheduledStartTime) === false) {
            continue;
        }
        if (this.canSchedule(obj1, obj1.ScheduledStartTime + obj2.Exptime) === false) {
            continue;
        }
        am1now = (obj1.AltStartTime + obj1.AltMidTime + obj1.AltEndTime) / 3;
        am2now = (obj2.AltStartTime + obj2.AltMidTime + obj2.AltEndTime) / 3;
        am1if = obj1.getAltitude(obj1.ScheduledStartTime + obj2.Exptime + 0.5 * obj1.Exptime);
        am2if = obj2.getAltitude(obj1.ScheduledStartTime + 0.5 * obj2.Exptime);
        exchange = false;
        if (((am1now < am2now) && (am2if > am1now) && (am1if > am1now)) ||
                ((am2now < am1now) && (am1if > am2now) && (am2if > am2now))) {
            exchange = true;
        }
        t1 = obj1.ScheduledStartTime;
        if (exchange) {
            obj2.Schedule(t1);
            obj1.Schedule(t1 + obj2.Exptime);
            c = scheduleorder[i];
            scheduleorder[i] = scheduleorder[i + 1];
            scheduleorder[i + 1] = c;
        }
    }
};

TargetList.prototype.optimize_moveToLaterTimesIfRising = function (scheduleorder, crossOtherObjects) {
    var i, obj, j, kj, curtime, overlaps, amif;
    for (i = scheduleorder.length - 1; i >= 0; i -= 1) {
        obj = this.Targets[scheduleorder[i]];
        if (obj.Observed) {
            continue;
        }
        if (obj.FillSlot) {
            continue;
        }
        if (obj.ZenithTime <= obj.ScheduledStartTime) {
            continue;
        }
        var bestalt = obj.AltMidTime;
        var besttime = obj.ScheduledStartTime;
        // Move to the right as much as possible Math.floor(this.Exptime/night.xstep)*night.xstep
        for (curtime = Math.min(((i == scheduleorder.length - 1 || crossOtherObjects) ? driver.night.Sunrise : this.Targets[scheduleorder[i + 1]].ScheduledStartTime), obj.LastPossibleTime, driver.night.Sunset + Math.floor((2 * obj.ZenithTime - obj.ScheduledMidTime - driver.night.Sunset) / driver.night.xstep) * driver.night.xstep);
                curtime > obj.ScheduledStartTime;
                curtime -= driver.night.xstep) {
            overlaps = false;
            for (j = 0; j < scheduleorder.length; j += 1) {
                if (j == i) {
                    continue;
                }
                kj = scheduleorder[j];
                if (this.Targets[kj].Scheduled === false) {
                    continue;
                }
                if (curtime + obj.Exptime <= this.Targets[kj].ScheduledStartTime ||
                        curtime >= this.Targets[kj].ScheduledEndTime) {
                    continue;
                }
                overlaps = true;
                break;
            }
            if (overlaps) {
                continue;
            }
            if (this.canSchedule(obj, curtime)) {
                amif = obj.getAltitude(curtime + 0.5 * obj.Exptime);
                if (amif > bestalt) {
                    bestalt = amif;
                    besttime = curtime;
                }
            }
        }
        if (besttime > obj.ScheduledStartTime) {
            obj.Schedule(besttime);
        }
    }
};

TargetList.prototype.reorder_accordingToScheduling = function (scheduleorder) {
    var newtargets = [], i, j, k, imin, tmin, tj;
    for (i = 0; i < scheduleorder.length - 1; i += 1) {
        imin = i;
        tmin = this.Targets[scheduleorder[i]].ScheduledStartTime;
        for (j = i + 1; j < scheduleorder.length; j += 1) {
            tj = this.Targets[scheduleorder[j]].ScheduledStartTime;
            if (tj < tmin) {
                imin = j;
                tmin = tj;
            }
        }
        if (imin > i) {
            k = scheduleorder[i];
            scheduleorder[i] = scheduleorder[imin];
            scheduleorder[imin] = k;
        }
    }
    var running = 0;
    for (i = 0; i < scheduleorder.length; i += 1) {
        k = scheduleorder[i];
        this.Targets[k].rxmid = driver.graph.targetsx;
        this.Targets[k].rymid = driver.graph.targetsy + running * (driver.graph.targetsyskip * (driver.graph.doubleTargets ? 2 : 1) + 2) - 6.5;
        this.Targets[k].Index = running;
        running += 1;
        newtargets.push(this.Targets[scheduleorder[i]]);
    }
    for (i = 0; i < this.nTargets; i += 1) {
        if (this.Targets[i].Scheduled === false) {
            this.Targets[i].rxmid = driver.graph.targetsx;
            this.Targets[i].rymid = driver.graph.targetsy + running * (driver.graph.targetsyskip * (driver.graph.doubleTargets ? 2 : 1) + 2) - 6.5;
            this.Targets[i].Index = running;
            running += 1;
            newtargets.push(this.Targets[i]);
        }
    }
    this.Targets = newtargets;
};

TargetList.prototype.display_scheduleStatistics = function () {
    var projtime = [];
    var time_dark = driver.night.DarkTime * 86400;
    var time_night = driver.night.NightLength * 86400;
    var time_sched = 0;
    var i, obj, j, k, inserted, minproj, minloc, exch;
    for (i = 0; i < this.nTargets; i += 1) {
        obj = this.Targets[i];
        if (obj.Scheduled) {
            time_sched += obj.ExptimeSeconds;
            inserted = false;
            for (j = 0; j < projtime.length; j += 1) {
                if (projtime[j].pid == obj.ProjectNumber) {
                    projtime[j].exp += obj.ExptimeSeconds;
                    inserted = true;
                    break;
                }
            }
            if (inserted === false) {
                projtime.push({'pid': obj.ProjectNumber, 'exp': obj.ExptimeSeconds});
            }
        }
    }
    for (j = 0; j < projtime.length - 1; j += 1) {
        minproj = projtime[j].pid;
        minloc = j;
        for (k = j + 1; k < projtime.length; k += 1) {
            if (projtime[k].pid < minproj) {
                minproj = projtime[k].pid;
                minloc = k;
            }
        }
        if (minloc > j) {
            exch = projtime[j];
            projtime[j] = projtime[minloc];
            projtime[minloc] = exch;
        }
    }
    var time_lost = 0, bwst, bwen;
    for (i = 0; i < this.Offline; i += 1) {
        bwst = Math.min(Math.max(this.Offline[i].Start, driver.night.ENauTwilight), driver.night.MNauTwilight);
        bwen = Math.max(Math.min(this.Offline[i].End, driver.night.MNauTwilight), driver.night.ENauTwilight);
        time_lost += bwen - bwst;
    }
    time_lost *= 86400;
    var time_free = time_night - time_sched - time_lost;
    var ratio_sched = Math.round(time_sched * 100 / time_night);
    var ratio_lost = Math.round(time_lost * 100 / time_night);
    var ratio_free = time_free > 0 ? Math.round(time_free * 100 / time_night) : 0;
    if (ratio_sched + ratio_lost + ratio_free !== 100) {
        if (time_free > 0) {
            ratio_free = 100 - ratio_sched - ratio_lost;
        }
        else {
            ratio_lost = 100 - ratio_sched;
        }
    }
    helper.LogSuccess('Night length (ENT-MNT):    ' + helper.ReportSHM(time_night));
    helper.LogEntry('Dark time (EAT-MAT):       ' + helper.ReportSHM(time_dark));
    if (time_sched > 0) {
        helper.LogSuccess('Scheduled observing time:  ' + helper.ReportSHM(time_sched) + ' (' + ratio_sched.toFixed(0) + '%)');
    }
    if (time_lost > 0) {
        helper.LogSuccess('Offline (lost) time:       ' + helper.ReportSHM(time_lost) + ' (' + ratio_lost.toFixed(0) + '%)');
    }
    if (time_night - time_sched - time_lost > 0) {
        helper.LogSuccess('Non-scheduled (free) time: ' + helper.ReportSHM(time_night - time_sched - time_lost) + ' (' + ((ratio_sched + ratio_lost) > 100 ? 0 : (100 - ratio_sched - ratio_lost)).toFixed(0) + '%)');
    }
    if (time_sched > 0) {
        helper.LogSuccess('Breakdown of observing time per proposal:');
        for (j = 0; j < projtime.length; j += 1) {
            helper.LogSuccess('    ' + projtime[j].pid + ':  ' + helper.ReportSHM(projtime[j].exp));
        }
    }
};

TargetList.prototype.schedule_inOrderOfSetting = function (startingAt) {
    var EndTimes = [];
    var temporder = [];
    var prevschedule = [];
    var i, j = 0, k, obj;
    for (i = 0; i < this.nTargets; i += 1) {
        if (this.Targets[i].Observed) {
            prevschedule.push(i);
            continue;
        }
        this.Targets[i].Scheduled = false;
        if (this.Targets[i].ObservableTonight === false) {
            continue;
        }
        temporder[j] = i;
        EndTimes[j++] = this.Targets[i].LastPossibleTime;
    }
    var SchedulableObjects = j;
    // Sort object by end time (argsort in python...)
    var mapped = EndTimes.map(function (el, i) {
        return {index: i, value: el};
    });
    mapped.sort(function (a, b) {
        return +(a.value > b.value) || +(a.value === b.value) - 1;
    });
    var maporder = mapped.map(function (el) {
        return el.index;
    });
    var order = [];
    for (i = 0; i < SchedulableObjects; i += 1) {
        order[i] = temporder[maporder[i]];
    }

    // Start the earliest possible
    var firstSchedulableTime = driver.night.Sunrise;
    var lastSchedulableTime = driver.night.Sunset;
    for (i = 0; i < SchedulableObjects; i += 1) {
        k = order[i];
        if (this.Targets[k].FirstPossibleTime < firstSchedulableTime) {
            firstSchedulableTime = this.Targets[k].FirstPossibleTime;
        }
        if (this.Targets[k].LastPossibleTime > lastSchedulableTime) {
            lastSchedulableTime = this.Targets[k].LastPossibleTime;
        }
    }
    if (firstSchedulableTime < startingAt) {
        firstSchedulableTime = startingAt;
    }
    // Start scheduling
    var scheduleorder = [];
    // However, before anything else we schedule the monitoring programmes that have highest priority and MUST fill their entire time slot
    for (i = 0; i < SchedulableObjects; i += 1) {
        k = order[i];
        if (this.Targets[k].FillSlot === true) {
            obj = this.Targets[k];
            obj.Schedule(obj.RestrictionMinUT);
            scheduleorder.push(k);
        }
    }

    // Now go through all the other objects
    var curtime = firstSchedulableTime;
    while (true) {
        i = 0;
        while (i < SchedulableObjects) {
            k = order[i];
            obj = this.Targets[k];
            if (obj.Scheduled === true) {
                i += 1;
                continue;
            }
            if (this.canSchedule(obj, curtime)) {
                obj.Schedule(curtime);
                curtime += obj.Exptime;
                scheduleorder.push(k);
                i = 0;
            } else {
                i += 1;
            }
        }
        if ((scheduleorder.length < SchedulableObjects) && (curtime < lastSchedulableTime)) {
            curtime += driver.night.xstep;
        } else {
            break;
        }
    }
    return prevschedule.concat(scheduleorder);
};

TargetList.prototype.scheduleAndOptimize_givenOrder = function (newscheduleorder) {
    var scheduleorder = [], i, k, obj;
    for (i = 0; i < this.nTargets; i += 1) {
        if (this.Targets[i].Observed) { // attention here. more work to be done!
            continue;
        }
        this.Targets[i].Scheduled = false;
    }
    for (i = 0; i < this.nTargets; i += 1) {
        if (this.Targets[i].FillSlot === true) {
            obj = this.Targets[i];
            obj.Schedule(obj.RestrictionMinUT);
            //helper.LogSuccess('Rescheduling @ '+obj.RestrictionMinUT);
        }
    }
    var curtime = driver.night.Sunset;
    i = 0;
    while (i < this.nTargets && curtime <= driver.night.Sunrise) {
        k = newscheduleorder[i];
        if (this.Targets[k].FillSlot === true) {
            scheduleorder.push(k);
            i += 1;
            continue;
        }
        if (curtime > this.Targets[k].LastPossibleTime) {
            i += 1;
            continue;
        }
        obj = this.Targets[k];
        if (this.canSchedule(obj, curtime)) {
            obj.Schedule(curtime);
            scheduleorder.push(k);
            //helper.LogSuccess('Rescheduling '+i+' ('+k+') @ '+ curtime);
            curtime += obj.Exptime;
            i += 1;
        } else {
            curtime += driver.night.xstep;
        }
    }

    this.optimize_moveToLaterTimesIfRising(scheduleorder, false);
    this.reorder_accordingToScheduling(scheduleorder);
    this.display_scheduleStatistics();
};

TargetList.prototype.prepareScheduleForUpdate = function () {
    helper.LogEntry('Preparing schedule for update...');
    helper.LogEntry('Checking existing targets against input...');
    var i, bFound, k;
    var unchanged = [], updated = [], updateText = [], reinserting = [], deleting = [], adding = [];
    var lines_original = helper.extractLines($('#targets_actual').val());
    var lines = lines_original.map(function (obj) {
        return obj.replace(/\s\s+/g, ' ').trim();
    });
    for (i = 0; i < this.nTargets; i += 1) {
        k = lines.indexOf(this.Targets[i].ReconstructedInput);
        if (k > -1) {
            lines.splice(k, 1);
            lines_original.splice(k, 1);
            unchanged.push(i);
        }
    }
    if (unchanged.length !== this.nTargets) {
        for (i = 0; i < this.nTargets; i += 1) {
            if (unchanged.indexOf(i) > -1) {
                continue;
            }
            bFound = false;
            for (k = 0; k < lines.length; k += 1) {
                if (lines[k].indexOf(this.Targets[i].ReconstructedMinimumInput) > -1) {
                    bFound = true;
                    break;
                }
            }
            if (bFound) {
                updated.push(i);
                updateText.push(lines[k]);
                lines.splice(k, 1);
                lines_original.splice(k, 1);
            } else {
                if (this.Targets[i].Observed) {
                    reinserting.push(i);
                } else {
                    deleting.push(i);
                }
            }
        }
    }
    if (lines.length > 0) {
        for (i = 0; i < lines.length; i += 1) {
            adding.push(lines[i].substr(0, lines[i].indexOf(' ')).trim());
        }
        $('#added_targets').val(lines_original.join("\n"));
        helper.LogSuccess($('#added_targets').val());
    }

    if (unchanged.length == this.nTargets && updated.length === 0 && reinserting.length === 0 && deleting.length === 0 && adding.length === 0) {
        helper.LogWarning('Attention: no change detected in the input form. Leaving schedule as it is.');
        return '';
    }

    if ($('#opt_reschedule_later').is(':checked')) {
        var now = new Date();
        //now = new Date(Date.UTC(2017, 2, 16, 20, 0, 0)); // debug!!!
        helper.LogEntry('Current time: ' + now.toUTCString());
        if (now > driver.night.DateSunset && now < driver.night.DateSunrise) {
            helper.LogWarning('Attention: the night has already started, so we will only reschedule after the current time. The previously observed objects will NOT be affected, but objects scheduled in the past that have not yet been observed may only be rescheduled in the future, if there is enough free time.');
            this.StartingAt = driver.night.Sunset + (now - driver.night.DateSunset) / 1000 / 86400;
        } else {
            helper.LogWarning('We are not currently in the middle of the observing night. Scheduling as usual...');
            return false;
        }
    } else {
        this.StartingAt = driver.night.Sunset;
    }

    var fnn = function (idx) {
        return driver.targets.Targets[idx].Name;
    };
    helper.LogSuccess('Status report:');
    helper.LogEntry('  Unchanged existing targets: ' + unchanged.length +
            (unchanged.length > 0 ? ' (<i>' + unchanged.map(fnn).join(', ') + '</i>)' : ''));
    helper.LogEntry('  Updated existing targets: ' + updated.length +
            (updated.length > 0 ? ' (<i>' + updated.map(fnn).join(', ') + '</i>)' : ''));
    helper.LogEntry('  Deleted observed targets (must add them back): ' + reinserting.length +
            (reinserting.length > 0 ? ' (<i>' + reinserting.map(fnn).join(', ') + '</i>)' : ''));
    helper.LogEntry('  Removed targets: ' + deleting.length +
            (deleting.length > 0 ? ' (<i>' + deleting.map(fnn).join(', ') + '</i>)' : ''));
    helper.LogEntry('  New targets (will insert): ' + adding.length +
            (adding.length > 0 ? ' (<i>' + adding.join(', ') + '</i>)' : ''));
    // Unchanged targets remain unchanged. Nothing to do
    // Then update the existing targets (no need to call the ajax script for that)
    if (updated.length > 0) {
        this.resetWarnings();
        var newdata, obj; // change: first do badwolf
        for (i = 0; i < updated.length; i += 1) {
            newdata = updateText[i].trim().split(' ');
            obj = this.Targets[updated[i]];
            obj.Update(newdata.slice(8));
        }
        this.warnUnobservable();
    }
    // Then, leave the targets that must be "added back" as they are
    // Then, remove the targets that need to be removed
    if (deleting.length > 0) {
        var newTargets = [];
        for (i = 0; i < this.nTargets; i += 1) {
            if (deleting.indexOf(i) == -1) {
                newTargets.push(this.Targets[i]);
            }
        }
        this.Targets = newTargets;
        this.nTargets = newTargets.length;
    }
    // Finally, call the ajax script to get the altitudes for the new targets
    if (adding.length > 0) {
        return 'tgts';
    } else {
        return true;
    }
};

TargetList.prototype.updateSchedule = function (Targets) {
    var scheduleorder = this.schedule_inOrderOfSetting(this.StartingAt);
    this.optimize_interchangeNeighbours(scheduleorder);
    this.optimize_moveToLaterTimesIfRising(scheduleorder, true);
    this.optimize_interchangeNeighbours(scheduleorder);
    this.reorder_accordingToScheduling(scheduleorder);
    this.display_scheduleStatistics();
};

TargetList.prototype.inputHasChanged = function (_newinput, _oldinput) {
    return (_newinput !== _oldinput);
};

/*
 Format the list of targets that already has the correct syntax by adding spaces
 so that the various columns fall nicely under each other.
 */
TargetList.prototype.validateAndFormatTargets = function () {
    // Retrieve content of #targets textarea
    //var tgts = $('#targets').val().trim();
    var tgts = driver.CMeditor.getValue();
    if (!this.inputHasChanged(tgts, this.InputText) && this.InputValid) {
        helper.LogEntry('Target input list has not changed, no need to revalidate.');
        return true;
    } else {
        helper.LogEntry('Validating and formatting target input list...');
    }
    $('#tcsExport').prop("disabled", true);
    this.InputValid = false;
    if (tgts.length === 0) {
        helper.LogError('Error: Please fill in the <i>Targets</i> field.');
        return false;
    }
    // Split it into lines
    var lines = helper.extractLines(tgts);
    this.VisibleLines = [];
    this.TargetsLines = [];
    this.FormattedLines = [];
    // Determine maximum width of the various fields
    this.MaxLen = {Name: 0, RA: 0, Dec: 0, Exp: 0, AM: 0, Type: 0, TCSpmra: 0, TCSpmdec: 0};
    this.BadWolfStart = [];
    this.BadWolfEnd = [];
    var words, i, j, len;
    for (i = 0, len = lines.length; i < len; i += 1) {
        if (lines[i].trim() === '') {
            this.FormattedLines.push(null);
            continue;
        }
        words = this.extractLineInfo(i + 1, lines[i].trim());
        if (words === false) {
            return false; // Does not validate
        }
        var mLTN = driver.graph.maxLenTgtName + (words[0][0] == '#' ? 1 : 0);
        if (words[0].length > mLTN) {
            words[0] = words[0].substr(0, mLTN);
        }
        if (words[0].length > this.MaxLen.Name) {
            this.MaxLen.Name = words[0].length;
        }
        if (words[3].length > this.MaxLen.RA) {
            this.MaxLen.RA = words[3].length;
        }
        if (words[6].length > this.MaxLen.Dec) {
            this.MaxLen.Dec = words[6].length;
        }
        if (words[8].length > this.MaxLen.Exp) {
            this.MaxLen.Exp = words[8].length;
        }
        if (words[10].length > this.MaxLen.AM) {
            this.MaxLen.AM = words[10].length;
        }
        if (words[11].length > this.MaxLen.Type) {
            this.MaxLen.Type = words[11].length;
        }
        j = (parseInt(words[13]) + '').length + (words[13] < 0 && words[13] > -1 ? 1 : 0);
        if (j > this.MaxLen.TCSpmra) {
            this.MaxLen.TCSpmra = j;
        }
        j = (parseInt(words[15]) + '').length + (words[15] < 0 && words[15] > -1 ? 1 : 0);
        if (j > this.MaxLen.TCSpmdec) {
            this.MaxLen.TCSpmdec = j;
        }
        this.FormattedLines.push(words);
    }
    this.InputStats = {Empty: 0, Commented: 0, Actual: 0};
    var padded, badwolf;
    this.TCSlines = [];
    for (i = 0, len = this.FormattedLines.length; i < len; i += 1) {
        if (this.FormattedLines[i] === null) {
            this.VisibleLines.push('');
            this.InputStats.Empty += 1;
            continue;
        }
        words = this.FormattedLines[i];
        badwolf = (words[0] == 'BadWolf' || words[0] == 'Offline');
        padded = [helper.pad(words[0], this.MaxLen.Name, false, ' '),
            helper.pad(words[1], 2, true, badwolf ? ' ' : '0'),
            helper.pad(words[2], 2, true, badwolf ? ' ' : '0'),
            helper.pad(words[3], this.MaxLen.RA, false, ' '),
            helper.pad(badwolf ? words[4] : helper.padTwoDigits(words[4]), 3, true, ' '),
            helper.pad(words[5], 2, true, badwolf ? ' ' : '0'),
            helper.pad(words[6], this.MaxLen.Dec, false, ' '),
            helper.pad(words[7], 4, true, ' '),
            helper.pad(words[8], this.MaxLen.Exp, true, ' '),
            helper.pad(words[9], 6, false, ' '),
            helper.pad(words[10], this.MaxLen.AM, false, ' '),
            helper.pad(words[11], this.MaxLen.Type, false, ' ')];
        this.VisibleLines.push(padded.join(" "));
        if (words[0][0] == '#') {
            this.InputStats.Commented += 1;
            continue;
        }
        if (!badwolf) {
            this.TCSlines.push(helper.pad(words[0].replace(/[^A-Za-z0-9\_\+\-]+/g, ''), this.MaxLen.Name, false, ' ') + ' ' +
                    helper.padTwoDigits(words[1]) + ':' +
                    helper.padTwoDigits(words[2]) + ':' +
                    helper.pad(parseFloat(words[12]).toFixed(2).toString(), 5, true, '0') + ' ' +
                    helper.pad(helper.padTwoDigits(words[4]), 3, true, ' ') + ':' +
                    helper.pad(words[5], 2, true, '0') + ':' +
                    helper.pad(parseFloat(words[14]).toFixed(1).toString(), 4, true, '0') + ' ' +
                    helper.pad(words[7], 4, ' ') + ' ' +
                    helper.pad(parseFloat(words[13]).toFixed(2).toString(), this.MaxLen.TCSpmra + 3, true, ' ') + ' ' +
                    helper.pad(parseFloat(words[15]).toFixed(2).toString(), this.MaxLen.TCSpmdec + 3, true, ' ') + ' ' +
                    '0.0');
            this.InputStats.Actual += 1;
            this.TargetsLines.push(padded.join(" "));
        }
    }

    if (this.InputStats.Actual === 0) {
        if (this.InputStats.Commented > 0 || this.InputStats.Empty > 0) {
            helper.LogError('Error: no valid targets found (input consists of ' +
                    (this.InputStats.Commented > 0 ? helper.plural(this.InputStats.Commented, 'commented-out line') + (this.InputStats.Empty > 0 ? ' and ' : '') : '') +
                    (this.InputStats.Empty > 0 ? helper.plural(this.InputStats.Empty, 'empty line') : '') + ').');
        } else {
            helper.LogError('Error: no targets given.');
        }
        return false;
    }

    this.checkForDuplicates();

    //$('#targets').val(newlines.join("\n"));
    driver.CMeditor.setValue(this.VisibleLines.join("\n"));
    $('#targets_actual').val(this.TargetsLines.join("\n"));
    var nt = this.TargetsLines.length;
    helper.LogEntry('Done. Target list looks properly formatted (' + helper.plural(this.InputStats.Actual, 'target') + ').');
    this.InputText = driver.CMeditor.getValue();
    this.InputValid = true;
    $('#tcsExport').prop("disabled", false);
    return true;
};

TargetList.prototype.ExportTCSCatalogue = function () {
    helper.LogEntry('Exporting catalogue in TCS format...');
    if (!this.InputValid) {
        helper.LogError('Error: the list of targets appears to be invalid... Aborting.');
        return;
    }
    if (this.TCSlines.length === 0) {
        helper.LogError('Error: catalogue contains no targets. Aborting.');
        return;
    }

    $('#tcspre').html(this.TCSlines.join("\n"));
    $.fancybox({
        'href': '#tcscat',
        'width': '95%',
        'maxWidth': 900
    });

    helper.LogEntry('Done.');
};

/*
 Extract one line of input from the input textarea; return an array containing the items
 */
TargetList.prototype.extractLineInfo = function (linenumber, linetext) {
    // Split by white spaces
    var words = linetext.match(/(\[[0-9:-]+\]|[^\[\]\s:]+)/g);
    // Sanity check: minimum number of fields
    if (words.length <= 1) {
        helper.LogError('Error: Incorrect syntax on Line #' + linenumber + '; for each object you must provide at least the Name, RA and Dec!');
        return false;
    }
    if (words[0] == 'BadWolf' || words[0] == 'Offline') {
        if (words.length < 2 || words.length > 3) {
            helper.LogError('Error: Incorrect syntax on Line #' + linenumber + '; for offline time you must provide a valid UT range!');
            return false;
        }
        if (words.length == 3) {
            if (words[1] != '*') {
                helper.LogError('Error: Incorrect syntax on Line #' + linenumber + '; offline time must take "*" as [OBSTIME] argument!');
                return false;
            }
        }
        var q = (words.length == 2) ? 1 : 2;
        var UTr = helper.ExtractUTRange(words[q]), ut1, ut2;
        if (UTr === false) {
            helper.LogError('Error: Incorrect syntax in [CONSTRAINTS] on line #' + linenumber + ': the UT range must be a valid interval (e.g., [20:00-23:00] or [1-2])!');
            return false;
        } else {
            this.BadWolfStart.push(UTr[0]);
            this.BadWolfEnd.push(UTr[1]);
        }
        return [words[0], '', '', '', '', '', '', '', '*', '', words[q], ''];
    }
    if (words.length == 6 && words[2].indexOf(':') == -1) {
        words = ['Object' + linenumber].concat(words);
    }
    if ((words[1].indexOf(':') == -1 && words.length < 7) ||
            (words[1].indexOf(':') > -1 && words.length < 3)) {
        helper.LogError('Error: Incorrect syntax on Line #' + linenumber + '; for each object you must provide at least the Name, RA and Dec!');
        return false;
    }
    if (words.length === 11 && (parseFloat(words[7]) == 2000 || parseFloat(words[7]) == 1950) && !helper.notFloat(words[8]) && !helper.notFloat(words[9]) && !helper.notFloat(words[10])) {
        words = [words[0], words[1], words[2], words[3] + (parseFloat(words[8]) !== 0 ? '/' + words[8] : ''), words[4], words[5], words[6] + (parseFloat(words[9]) !== 0 ? '/' + words[9] : ''), words[7]].concat([Driver.defaultObstime, Driver.defaultProject, Driver.defaultAM, Driver.defaultType]);
    }
    if (words.length == 7) {
        words = words.concat([Driver.defaultEpoch, Driver.defaultObstime, Driver.defaultProject, Driver.defaultAM, Driver.defaultType]);
    } else if (words.length == 8) {
        words = words.concat([Driver.defaultObstime, Driver.defaultProject, Driver.defaultAM, Driver.defaultType]);
    } else if (words.length == 9) {
        words = words.concat([Driver.defaultProject, Driver.defaultAM, Driver.defaultType]);
    } else if (words.length == 10) {
        words = words.concat([Driver.defaultAM, Driver.defaultType]);
    } else if (words.length == 11) {
        words = words.concat([Driver.defaultType]);
    }
    // Sanity check: there must now be exactly 12 entries in the array
    if (words.length !== 12) {
        helper.LogError('Error: Incorrect syntax: the number of entries on line #' + linenumber + ' is incorrect!');
        return false;
    }
    var rax;
    // Sanity check: input syntax for all parameters
    /* RA hours, minutes must be integer */
    if (helper.notInt(words[1]) || helper.notInt(words[2])) {
        helper.LogError('Error: Incorrect syntax: non-integer value detected in [RA] on line #' + linenumber + '!');
        return false;
    }
    /* RA hours between 0 and 23 */
    rax = parseInt(words[1]);
    if (rax < 0 || rax > 23) {
        helper.LogError('Error: Incorrect syntax: the "hours" part of [RA] must be an integer between 0 and 23 on line #' + linenumber + '!');
        return false;
    }
    /* RA minutes between 0 and 59 */
    rax = parseInt(words[2]);
    if (rax < 0 || rax > 59) {
        helper.LogError('Error: Incorrect syntax: the "minutes" part of [RA] must be an integer between 0 and 59 on line #' + linenumber + '!');
        return false;
    }
    /* RA seconds and proper motion */
    if (words[3].indexOf('/') > -1) {
        rax = words[3].split('/');
        if (rax.length !== 2) {
            helper.LogError('Error: Incorrect syntax for [pmRA] on line #' + linenumber + '!');
            return false;
        } else {
            if (helper.notFloat(rax[0]) || helper.notFloat(rax[1])) {
                helper.LogError('Error: Incorrect syntax: non-float value detected in [RA]/[pmRA] on line #' + linenumber + '!');
                return false;
            }
        }
        words[12] = parseFloat(rax[0]);
        words[13] = parseFloat(rax[1]);
        words[13] = Math.max(-1000, Math.min(1000, words[13]));
    } else if (helper.notFloat(words[3])) {
        helper.LogError('Error: Incorrect syntax: non-integer value detected in [RA] on line #' + linenumber + '!');
        return false;
    } else {
        words[12] = parseFloat(words[3]);
        words[13] = 0;
    }
    /* RA seconds, integer part between 0 and 59 */
    if (parseInt(words[12]) < 0 || parseInt(words[12]) > 59) {
        helper.LogError('Error: Incorrect syntax: the integer part of "seconds" in [RA] must be a number between 0 and 59 on line #' + linenumber + '!');
        return false;
    }
    /* Dec degrees, arcminutes must be integer */
    if (helper.notInt(words[4]) || helper.notInt(words[5])) {
        helper.LogError('Error: Incorrect syntax: non-integer value detected in [DEC] on line #' + linenumber + '!');
        return false;
    }
    /* Dec degrees between -89 and +89 */
    rax = parseInt(words[4]);
    if (rax < -89 || rax > 89) {
        helper.LogError('Error: Incorrect syntax: the "degrees" part of [Dec] must be an integer between -89 and +89 on line #' + linenumber + '!');
        return false;
    }
    /* Dec arcminutes between 0 and 59 */
    rax = parseInt(words[5]);
    if (rax < 0 || rax > 59) {
        helper.LogError('Error: Incorrect syntax: the "minutes" part of [Dec] must be an integer between 0 and 59 on line #' + linenumber + '!');
        return false;
    }
    /* Dec arcseconds and proper motion */
    if (words[6].indexOf('/') > -1) {
        rax = words[6].split('/');
        if (rax.length !== 2) {
            helper.LogError('Error: Incorrect syntax for [pmDEC] on line #' + linenumber + '!');
            return false;
        } else {
            if (helper.notFloat(rax[0]) || helper.notFloat(rax[1])) {
                helper.LogError('Error: Incorrect syntax: non-float value detected in [DEC]/[pmDEC] on line #' + linenumber + '!');
                return false;
            }
        }
        words[14] = parseFloat(rax[0]);
        words[15] = parseFloat(rax[1]);
        words[15] = Math.max(-1000, Math.min(1000, words[15]));
    } else if (helper.notFloat(words[6])) {
        helper.LogError('Error: Incorrect syntax: non-integer value detected in [DEC] on line #' + linenumber + '!');
        return false;
    } else {
        words[14] = parseFloat(words[6]);
        words[15] = 0;
    }
    /* Dec arcseconds, integer part between 0 and 59 */
    if (parseInt(words[14]) < 0 || parseInt(words[14]) > 59) {
        helper.LogError('Error: Incorrect syntax: the integer part of "arcseconds" in [Dec] must be a number between 0 and 59 on line #' + linenumber + '!');
        return false;
    }
    if (helper.filterFloat(words[7]) !== 2000 && helper.filterFloat(words[7]) !== 1950) {
        helper.LogError('Error: Incorrect syntax: [EPOCH] must be either 2000 or 1950 on line #' + linenumber + '!');
        return false;
    }
    if (words[9].length !== 6) {
        helper.LogError('Error: Incorrect syntax: [PROJECT] does not respect the NN-NNN syntax on line #' + linenumber + '!');
        return false;
    }
    if (helper.notInt(words[9].substr(0, 2)) || helper.notInt(words[9].substr(3, 3)) || words[9].substr(2, 1) != '-') {
        helper.LogError('Error: Incorrect syntax: [PROJECT] does not respect the NN-NNN syntax on line #' + linenumber + '!');
        return false;
    }
    if (helper.notFloat(words[10])) {
        if (words[10].substr(0, 1) != '[' || words[10].slice(-1) != ']' || words[10].indexOf('-') == -1) {
            helper.LogError('Error: Incorrect syntax: [CONSTRAINTS] should either be a float (e.g., 2.0) or a UT range (e.g., [20:00-23:00]) on line #' + linenumber + '!');
            return false;
        }
        if (helper.notInt(words[8]) && words[8] != '*') {
            helper.LogError('Error: Incorrect syntax: non-integer value detected in [OBSTIME] on line #' + linenumber + '!');
            return false;
        }
    } else {
        if (helper.notInt(words[8])) {
            helper.LogError('Error: Incorrect syntax: non-integer value detected in [OBSTIME] on line #' + linenumber + '!');
            return false;
        }
    }
    if ($.inArray(words[11], ['Monitor', 'ToO', 'SoftToO', 'Payback', 'Fast-Track', 'Service', 'Visitor', 'Staff']) === -1) {
        var wl = words[11].length;
        if (words[11].indexOf('Staff/') !== 0 || (words[11].indexOf('Staff/') === 0 && (wl < 8 || wl > 9))) {
            helper.LogError('Error: Incorrect syntax: [TYPE] must be one of the following: <i>Monitor</i>, <i>ToO</i>, <i>SoftToO</i>, <i>Payback</i>, <i>Fast-Track</i>, <i>Service</i>, <i>Visitor</i>, <i>Staff</i>, on line #' + linenumber + '!');
            return false;
        }
    }
    return words;
};

TargetList.prototype.checkForDuplicates = function () {
    var alreadyChecked = [], duplicateList = [];
    var i, j, len, found, duplString;

    len = this.FormattedLines.length;
    for (i = 0; i < len; i += 1) {
        if (alreadyChecked.indexOf(i) > -1) {
            continue;
        }
        if (this.VisibleLines[i] === "" || this.VisibleLines[i][0] === '#') {
            continue;
        }
        found = false;
        duplString = '';
        for (j = i + 1; j < len; j += 1) {
            if (this.VisibleLines[i] === this.VisibleLines[j]) {
                found = true;
                duplString += ', #' + (j + 1);
                alreadyChecked.push(j);
            }
        }
        if (found) {
            duplicateList.push('(#' + (i + 1) + duplString + ')');
        }
    }
    if (duplicateList.length > 0) {
        helper.LogWarning('Warning: Duplicate lines detected: ' + duplicateList.join(', ') + '. Please check if that is what you actually intended, otherwise delete or comment out the duplicates.');
    }
};

Target.prototype.canObserve = function (time, altitude) {
    if ((this.RestrictionMinUT <= time && this.RestrictionMaxUT >= time &&
            this.RestrictionMinAlt <= altitude && this.RestrictionMaxAlt >= altitude) === false) {
        return false;
    }
    var i;
    for (i = 0; i < driver.targets.Offline.length; i += 1) {
        if (time >= driver.targets.Offline[i].Start && time <= driver.targets.Offline[i].End) {
            return false;
        }
    }
    return true;
};

Target.prototype.preCompute = function () {
    // First, determine when it is allowed to observe and when not
    this.beginAllowed = [];
    this.endAllowed = [];
    this.beginForbidden = [];
    this.endForbidden = [];
    var nyobj = this.Graph.length, obs, i;
    obs = (this.canObserve(driver.night.xaxis[0], this.Graph[0]));
    this.observable[0] = obs;
    if (!obs) {
        this.beginForbidden.push(driver.night.xaxis[0]);
    } else {
        this.beginAllowed.push(driver.night.xaxis[0]);
    }
    for (i = 1; i < nyobj - 1; i += 1) {
        if (this.canObserve(driver.night.xaxis[i], this.Graph[i])) {
            if (!obs) {
                obs = true;
                this.endForbidden.push(driver.night.xaxis[i]);
                this.beginAllowed.push(driver.night.xaxis[i]);
            }
            this.observable[i] = true;
        } else {
            if (obs) {
                obs = false;
                this.endAllowed.push(driver.night.xaxis[i]);
                this.beginForbidden.push(driver.night.xaxis[i]);
            }
            this.observable[i] = false;
        }
    }
    this.observable[i] = this.canObserve(driver.night.xaxis[i], this.Graph[i]);
    if (this.beginForbidden.length !== this.endForbidden.length) {
        this.endForbidden.push(driver.night.xaxis[i]);
    } else {
        this.endAllowed.push(driver.night.axis[i]);
    }
    if (this.beginAllowed.length !== this.endAllowed.length || this.beginForbidden.length !== this.endForbidden.length) {
        helper.LogError('Bug report: safety check failed in @Target.prototype.preCompute. Please report this bug.');
    }
    this.nAllowed = this.beginAllowed.length;
    if (this.nAllowed === 0) {
        this.ObservableTonight = false;
        this.iLastPossibleTime = 0;
        this.LastPossibleTime = driver.night.Sunset;
        driver.targets.Warning1.push(this.Name);
        return;
    }
    this.FirstPossibleTime = this.beginAllowed[0];
    var lpt;
    for (i = this.nAllowed; i >= 0; i--) {
        if (this.beginAllowed[i] + this.Exptime <= this.endAllowed[i]) {
            lpt = this.endAllowed[i] - this.Exptime;
            this.iLastPossibleTime = helper.EphemTimeToIndex(lpt);
            this.LastPossibleTime = driver.night.Sunset + this.iLastPossibleTime * driver.night.xstep + this.ZenithTime / 1e9;
            this.ObservableTonight = true;
            return;
        }
    }
    driver.targets.Warning2.push(this.Name);
};

Target.prototype.getAltitude = function (time) {
    var ii = helper.EphemTimeToIndex(time);
    return this.Graph[ii];
};

Target.prototype.resetColours = function () {
    if (this.Observed) {
        this.LabelFillColor = 'green';
        this.LabelStrokeColor = 'green';
        this.LabelTextColor = 'white';
    } else {
        if ($('#opt_id_next_line').is(':checked')) {
            this.LabelFillColor = Driver.FillColors[this.Type];
            this.LabelTextColor = Driver.TextColors[this.Type];
            this.LabelStrokeColor = this.LabelFillColor;
        } else {
            this.LabelFillColor = 'white';
            this.LabelTextColor = (Driver.FillColors[this.Type] == 'blue' ? 'blue' : 'black');
            this.LabelStrokeColor = Driver.FillColors[this.Type];
        }
    }
};

Target.prototype.ComputePositionSchedLabel = function () {
    var xshift, yshift;
    if ($('#opt_id_next_line').is(':checked')) {
        var slope = driver.graph.degree * (this.AltEndTime - this.AltStartTime) / driver.graph.transformXWidth(this.Exptime);
        var angle = Math.atan(slope);
        var dist = driver.graph.CircleSize * 1.2;
        xshift = dist * Math.sin(angle);
        yshift = dist * Math.cos(angle);
    } else {
        xshift = 0;
        yshift = 0;
    }
    this.xmid = driver.graph.xaxis[this.iScheduledMidTime] - xshift;
    this.ymid = driver.graph.yend - driver.graph.degree * this.Graph[this.iScheduledMidTime] - yshift;
};

Target.prototype.Schedule = function (start) {
    this.Scheduled = true;
    this.ScheduledStartTime = start;
    this.ScheduledEndTime = start + this.Exptime;
    this.ScheduledMidTime = start + 0.5 * this.Exptime;
    this.iScheduledStartTime = helper.EphemTimeToIndex(this.ScheduledStartTime);
    this.iScheduledEndTime = helper.EphemTimeToIndex(this.ScheduledEndTime);
    this.iScheduledMidTime = helper.EphemTimeToIndex(this.ScheduledMidTime);
    this.AltStartTime = this.Graph[this.iScheduledStartTime];
    this.AltEndTime = this.Graph[this.iScheduledEndTime];
    this.AltMidTime = this.Graph[this.iScheduledMidTime];
    this.ComputePositionSchedLabel();
};

Target.prototype.Update = function (obj) {
    // obj: (0=exptime, 1=project, 2=constraints, 3=type)
    this.FullType = obj[3];
    this.Type = (obj[3].indexOf('/') === -1 ? obj[3] : obj[3].substring(0, obj[3].indexOf('/')));
    this.ProjectNumber = obj[1];
    this.Constraints = obj[2];
    var isUT, UTr = helper.ExtractUTRange(obj[2]), ut1, ut2;
    if (UTr === false) {
        isUT = false;
        this.MaxAirmass = driver.defaultAM;
    } else {
        isUT = true;
        ut1 = UTr[0];
        ut2 = UTr[1];
    }
    if (isUT) {
        this.MaxAirmass = 9.9;
        this.RestrictionMinUT = ut1;
        this.RestrictionMaxUT = ut2;
    } else {
        this.MaxAirmass = parseFloat(obj[2]);
        this.RestrictionMinUT = driver.night.ENauTwilight;
        this.RestrictionMaxUT = driver.night.MNauTwilight;
    }
    this.RestrictionMinAlt = helper.AirmassToAltitude(this.MaxAirmass);
    this.FillSlot = isUT && (obj[0] === '*');
    if (helper.filterInt(obj[0])) {
        this.ExptimeSeconds = parseInt(obj[0]);
        this.Exptime = Math.floor(this.ExptimeSeconds / 86400 / driver.night.xstep) * driver.night.xstep;
    } else {
        this.Exptime = this.FillSlot ? ut2 - ut1 : driver.defaultObstime / 86400;
        this.ExptimeSeconds = Math.round(this.Exptime * 86400);
        this.Exptime = Math.floor(this.Exptime / driver.night.xstep) * driver.night.xstep;
    }
    var hrs = Math.floor(this.ExptimeSeconds / 3600);
    var min = Math.round((this.ExptimeSeconds - hrs * 3600) / 60);
    this.ExptimeHM = (hrs > 0 ? hrs.toFixed(0) + 'h ' : '') + min.toFixed(0) + 'm';
    if (this.FillSlot) {
        helper.LogEntry('Attention: object <i>' + this.Name + '</i> will fill its entire time slot.');
    }
    this.preCompute();
    this.resetColours();
};