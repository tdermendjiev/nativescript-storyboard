var fs = require('fs'),
    xml2js = require('xml2js'),
    builder = require('xmlbuilder');

var parser = new xml2js.Parser();
var viewControllers = [];
var storyboardPath = './platforms/ios/nativescriptstoryboard/Main.storyboard';
var segues = [];

function addButtonToView(vcObj, button) {
    var buttonType = button.$.buttonType;
    var buttonAction = button.userDefinedRuntimeAttributes[0].userDefinedRuntimeAttribute[0].$.value;
    var buttonTitle = button.state[0].$.title;
    var frame = {
        x: button.rect[0].$.x,
        y: button.rect[0].$.y,
        width: button.rect[0].$.width,
        height: button.rect[0].$.height
    }
    var buttonObj = {
        type: "Button",
        buttonType: buttonType,
        action: buttonAction,
        title: buttonTitle,
        frame: frame,
        segue: {},
        xmlObj: {
            '@text': buttonTitle,
            '@tap': buttonAction,
            '@top': frame.y,
            '@left': frame.x,
            '@width': frame.width,
            '@height': frame.height
        }
    };
    if (button.color != undefined) {
        var bgColor = button.color[0].$;
        buttonObj.xmlObj['@style'] = 'background-color: rgb(' + bgColor.red * 255 + ', ' + bgColor.green *255 + ', ' + bgColor.blue*255 + ');';
    }
    if (button.state != undefined) {
            if (button.state[0].color != undefined && button.state[0].color[0] != undefined) {

                var textColor = button.state[0].color[0].$;
                buttonObj.xmlObj['@style'] += ' color: rgb(' + textColor.red * 255 + ', ' + textColor.green *255 + ', ' + textColor.blue*255 + ');'
            }
        }
    var action = {
        name: buttonAction,
        isSegue: (button.connections != undefined) && (button.connections[0].segue != undefined)
    }
    if (action.isSegue) {
        action["segueId"] = button.connections[0].segue[0].$.destination
    }
    vcObj.actions.push(action);
    vcObj.views.push(buttonObj);
}

function addLabelToView(vcObj, label) {
    var textColor = label.color[0].$;
    var frame = {
        x: label.rect[0].$.x,
        y: label.rect[0].$.y,
        width: label.rect[0].$.width,
        height: label.rect[0].$.height
    }
    var labelObj = {
        type: "Label",
        text: label.$.text,
        textColor: {
            red: textColor.red,
            blue: textColor.blue,
            green: textColor.green
        },
        frame: frame,
        xmlObj: {
            '@text': label.$.text,
            '@style': 'color: rgb(' + textColor.red * 255 + ', ' + textColor.green *255 + ', ' + textColor.blue*255 + ');',
            '@top': frame.y,
            '@left': frame.x,
            '@width': frame.width,
            '@height': frame.height
        }
    };
    vcObj.views.push(labelObj);
}

fs.readFile(storyboardPath, function(err, data) {
    parser.parseString(data, function (err, result) {
        
        var scenes = result.document.scenes[0].scene;
        for (var i = 0; i < scenes.length; i++) {
            var vc = scenes[i].objects[0].viewController[0];
            var vcObj = {
                attrs: {},
                views: []
            };
            vcObj["attrs"]["id"] = vc.$.id;
            vcObj["attrs"]["customClass"] = vc.$.customClass;
            vcObj["views"] = [];
            vcObj["pageName"] = vc.view[0].userDefinedRuntimeAttributes[0].userDefinedRuntimeAttribute[0].$.value;
            vcObj["actions"] = [];
            if (vc.view[0]["subviews"] != undefined) {
                let subviews = vc.view[0].subviews[0];
                for (var key in subviews) {
                    switch(key) {
                        case "button":
                            var buttons = subviews[key];

                            for (var y = buttons.length - 1; y >= 0; y--) {
                                button = buttons[y];
                                addButtonToView(vcObj, button);
                            }
                            break;
                        case "label":
                            var labels = subviews[key];
                            for (var y = labels.length - 1; y >= 0; y--) {
                                label = labels[y];
                                addLabelToView(vcObj, label);
                            }
                            break;
                        default:
                            break;
                    }
                }
            }
            
            viewControllers.push(vcObj);
        }

      for (var i = 0; i < viewControllers.length; i++) {
        var vc = viewControllers[i];
        var xmlObj = {
            Page: {
          AbsoluteLayout: {}
            }
        }

        for (var y = 0; y < vc.views.length; y++) {
            var view = vc.views[y];
            if (xmlObj.Page.AbsoluteLayout[view.type] == undefined) {
                xmlObj.Page.AbsoluteLayout[view.type] = [];
            }     
            xmlObj.Page.AbsoluteLayout[view.type].push(view.xmlObj);
            // actionName = view.action;
        }
        var xml = builder.create(xmlObj);

          fs.writeFile("./app/" + vc.pageName + ".xml", xml.toString({ pretty: true }), function(err) {
            if(err) {
                return console.log(err);
            }

            console.log("The file has been saved!");
          }); 

          var requireString = `var view = require("ui/core/view");\nvar frameModule = require("ui/frame");`;
          var functionString = "";

          for (var z = 0; z < vc.actions.length; z++) {
            var actionName = vc.actions[z].name;
            var actionImpl = "";
            if (vc.actions[z].isSegue) {
                var destination = "";
                for (var u = 0; u < viewControllers.length; u++) {

                    if (u==i) { continue };
                    console.log(viewControllers[u]);
                    console.log(vc.actions[z]);
                    if (viewControllers[u].attrs.id == vc.actions[z].segueId) {
                        destination = viewControllers[u].pageName
                        actionImpl = "\nvar topmost = frameModule.topmost();\ntopmost.navigate(" + "`" + destination + "`" +");\n\n"
                    }
                }
                
            }
            functionString += `\n\nfunction `+ actionName +`(args) {\n ` + actionImpl + `}\nexports.`+ actionName +` = `+ actionName +`;\n`
          }

    fs.writeFile("./app/" + vc.pageName + ".js", requireString + functionString, function(err) {
            if(err) {
                return console.log(err);
            }

            console.log("The file was saved!!!!");
          }); 

      }

      


    });
});