/******************************************************************************/
/*
 *
 * Copyright 2012-2016 AOL Inc. All rights reserved.
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this Software except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';

var dns            = require('dns')
  , iptrie         = require('iptrie')
  , wiseSource     = require('./wiseSource.js')
  , util           = require('util')
  ;
//////////////////////////////////////////////////////////////////////////////////
function removeArray(arr, value) {
  var pos = 0;
  while ((pos = arr.indexOf(value, pos)) !== -1) {
    arr.splice(pos, 1);
  }
  return arr;
}
//////////////////////////////////////////////////////////////////////////////////
function ReverseDNSSource (api, section) {
  ReverseDNSSource.super_.call(this, api, section);
  this.field        = api.getConfig("reversedns", "field");
  this.ips          = api.getConfig("reversedns", "ips");
  this.stripDomains = removeArray(api.getConfig("reversedns", "stripDomains", "").split(";"), "");
}
util.inherits(ReverseDNSSource, wiseSource);
//////////////////////////////////////////////////////////////////////////////////
ReverseDNSSource.prototype.init = function() {
  var self = this;

  if (self.field === undefined) {
    console.log("ReverseDNS - No field defined");
    return;
  }

  if (self.ips === undefined) {
    console.log("ReverseDNS - No ips defined");
    return;
  }

  self.api.addSource("reversedns", self);
  self.theField = self.api.addField("field:" + self.field);
  self.trie = new iptrie.IPTrie();
  self.ips.split(";").forEach(function(item) {
    if (item === "") {
      return;
    }
    var parts = item.split("/");
    self.trie.add(parts[0], +parts[1] || 32, true);
  });
};
//////////////////////////////////////////////////////////////////////////////////
ReverseDNSSource.prototype.getIp = function(ip, cb) {
  var self = this;

  if (!self.trie.find(ip)) {
    return cb(null, undefined);
  }

  dns.reverse(ip, function (err, domains) {
    //console.log("answer", ip, err, domains);
    if (err || domains.length === 0) {
      return cb(null, wiseSource.emptyResult);
    }
    var args = [];
    for (var i = 0; i < domains.length; i++) {
      var domain = domains[i];
      if (self.stripDomains.length === 0) {
        var parts = domain.split(".");
        args.push(self.theField, parts[0].toLowerCase());
      } else {
        for (var j = 0; j < self.stripDomains.length; j++) {
          var stripDomain = self.stripDomains[j];
          if (domain.indexOf(stripDomain, domain.length - stripDomain.length) !== -1) {
            args.push(self.theField, domain.slice(0, domain.length - stripDomain.length));
          }
        }
      }
    }
    var wiseResult = {num: args.length/2, buffer: wiseSource.encode.apply(null, args)};
    cb(null, wiseResult);
  });
};
//////////////////////////////////////////////////////////////////////////////////
exports.initSource = function(api) {
  var source = new ReverseDNSSource(api, "reversedns");
  source.init();
};
//////////////////////////////////////////////////////////////////////////////////
