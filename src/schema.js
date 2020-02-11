"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
Object.defineProperty(exports, "__esModule", { value: true });
var apollo_server_1 = require("apollo-server");
exports.default = apollo_server_1.gql(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n  type Test {\n    id: String\n    thing: String\n  }\n\n  type Query {\n    test: Test\n  }\n"], ["\n  type Test {\n    id: String\n    thing: String\n  }\n\n  type Query {\n    test: Test\n  }\n"])));
var templateObject_1;
