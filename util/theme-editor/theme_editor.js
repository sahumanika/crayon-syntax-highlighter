// Crayon Syntax Highlighter Theme Editor JavaScript

(function ($) {

    CrayonSyntaxThemeEditor = new function () {

        var base = this;

        var crayonSettings = CrayonSyntaxSettings;
        var adminSettings = CrayonAdminSettings;
        var settings = CrayonThemeEditorSettings;
        var strings = CrayonThemeEditorStrings;
        var admin = CrayonSyntaxAdmin;

        var preview, previewCrayon, previewCSS, status, title, info;
        var changed, loaded;
        var themeID, themeJSON, themeCSS, themeStr, themeInfo;
        var reImportant = /\s+!important$/gmi;
        var reSize = /^[0-9-]+px$/;
        var reCopy = /-copy(-\d+)?$/;
        var changedAttr = 'data-value';

        base.init = function (callback) {
            // Called only once
            CrayonUtil.log('editor init');
            base.initUI();
            if (callback) {
                callback();
            }
        };

        base.show = function (callback, crayon) {
            // Called each time editor is shown
            previewCrayon = crayon.find('.crayon-syntax');
            //crayon.attr('id', 'theme-editor-instance');
//            CrayonSyntax.process(crayon, true);
//            preview.html(crayon);
            preview.append(crayon)
            base.load();
            if (callback) {
                callback();
            }
        };

        base.load = function () {
            loaded = false;
            themeStr = adminSettings.currThemeCSS;
            themeID = adminSettings.currTheme;
            changed = false;
            themeJSON = CSSJSON.toJSON(themeStr, {
                stripComments: true,
                split: true
            });
            CrayonUtil.log(themeJSON);
            themeInfo = base.readCSSInfo(themeStr);
            base.initInfoUI();
            base.updateTitle();
            base.updateInfo();
            base.setFieldValues(themeInfo);
            base.populateAttributes();
            base.updateLiveCSS();
            base.updateUI();
            loaded = true;
        };

        base.save = function () {
            // Update info from form fields
            themeInfo = base.getFieldValues($.keys(themeInfo));
            // Get the names of the fields and map them to their values
            var names = base.getFieldNames(themeInfo);
            var info = {};
            for (var id in themeInfo) {
                info[names[id]] = themeInfo[id];
            }
            // Update attributes
            base.persistAttributes();
//            return false;
            // Save
            themeCSS = CSSJSON.toCSS(themeJSON);
            var newThemeStr = base.writeCSSInfo(info) + themeCSS;
            $.post(crayonSettings.ajaxurl, {
                action: 'crayon-theme-editor-save',
                id: themeID,
                name: base.getName(),
                css: newThemeStr
            }, function (result) {
                status.show();
                result = parseInt(result);
                if (result > 0) {
                    status.html(strings.success);
                    if (result === 2) {
                        window.GET['theme-editor'] = 1;
                        CrayonUtil.reload();
                    }
                } else {
                    status.html(strings.fail);
                }
                changed = false;
                setTimeout(function () {
                    status.fadeOut();
                }, 1000);
            });
        };

        base.delete = function (id, name) {
            base.createDialog({
                title: strings.delete,
                html: strings.deleteThemeConfirm.replace('%s', name),
                yes: function () {
                    $.post(crayonSettings.ajaxurl, {
                        action: 'crayon-theme-editor-delete',
                        id: id
                    }, function (result) {
                        if (result > 0) {
                            CrayonUtil.reload();
                        } else {
                            base.createAlert({
                                html: strings.deleteFail
                            });
                        }
                    });
                },
                options: {
                    selectedButtonIndex: 2
                }
            });
        };

        base.duplicate = function (id, name) {
            base.createPrompt({
                //html: "Are you sure you want to duplicate the '" + name + "' theme?",
                title: strings.duplicate,
                text: strings.newName,
                value: base.getNextAvailableName(id),
                ok: function (val) {
                    // TODO implement delete
                    $.post(crayonSettings.ajaxurl, {
                        action: 'crayon-theme-editor-duplicate',
                        id: id,
                        name: val
                    }, function (result) {
                        if (result > 0) {
                            CrayonUtil.reload();
                        } else {
                            base.createAlert({
                                html: strings.duplicateFail
                            });
                        }
                    });
                }
            });
        };

        base.getNextAvailableName = function (id) {
            var next = base.getNextAvailableID(id);
            return base.idToName(next[1]);
        };

        base.getNextAvailableID = function (id) {
            var themes = adminSettings.themes;
            var count = 0;
            if (reCopy.test(id)) {
                // Remove the "copy" if it already exists
                var newID = id.replace(reCopy, '');
                if (newID.length > 0) {
                    id = newID;
                }
            }
            var nextID = id;
            while (nextID in themes) {
                count++;
                if (count == 1) {
                    nextID = id + '-copy';
                } else {
                    nextID = id + '-copy-' + count.toString();
                }
            }
            return [count, nextID];
        };

        base.readCSSInfo = function (cssStr) {
            var infoStr = /^\s*\/\*[\s\S]*?\*\//gmi.exec(cssStr);
            var themeInfo = {};
            var match = null;
            var infoRegex = /([^\r\n:]*[^\r\n\s:])\s*:\s*([^\r\n]+)/gmi;
            while ((match = infoRegex.exec(infoStr)) != null) {
//                var fieldID = settings.fieldsInverse[match[1]];
//                var fieldID = base.convertToID(match[1]);
//                if (fieldID) {
//                    themeInfo[fieldID] = match[2];
//                }
                themeInfo[base.nameToID(match[1])] = CrayonUtil.encode_html(match[2]);
            }
            // Force title case on the name
            if (themeInfo.name) {
                themeInfo.name = base.idToName(themeInfo.name);
            }
            return themeInfo;
        };

        base.getFieldName = function (id) {
            var name = '';
            if (id in settings.fields) {
                name = settings.fields[id];
            } else {
                name = base.idToName(id);
            }
            return name;
        };

        base.getFieldNames = function (fields) {
            var names = {};
            for (var id in fields) {
                names[id] = base.getFieldName(id);
            }
            return names;
        };

        base.initInfoUI = function () {
            CrayonUtil.log(themeInfo);
            // TODO abstract
            var names = base.getFieldNames(themeInfo);
            var fields = {};
            for (var id in names) {
                var name = names[id];
                var value = themeInfo[id];
                fields[name] = base.createInput(id, value);
            }
            $('#tabs-1-contents').html(base.createForm(fields));
            base.getField('name').bind('change keydown keyup', function () {
                themeInfo.name = base.getFieldValue('name');
                base.updateTitle();
            });
        };

        base.nameToID = function (name) {
            return name.toLowerCase().replace(/\s+/gmi, '-');
        };

        base.idToName = function (id) {
            id = id.replace(/-/gmi, ' ');
            return id.toTitleCase();
        };

        base.getName = function () {
            var name = themeInfo.name;
            if (!name) {
                name = base.idToName(themeID);
            }
            return name;
        };

        base.getField = function (id) {
            return $('#' + settings.cssInputPrefix + id);
        };

        base.getFieldValue = function (id) {
            return base.getElemValue(base.getField(id));
        };

        base.getElemValue = function (elem) {
            if (elem) {
                // TODO add support for checkboxes etc.
                return elem.val();
            } else {
                return null;
            }
        };

        base.getFieldValues = function (fields) {
            var info = {};
            $(fields).each(function (i, id) {
                info[id] = base.getFieldValue(id);
            });
            return info;
        };

        base.setFieldValue = function (id, value) {
            base.setElemValue(base.getField(id), value);
        };

        base.setFieldValues = function (obj) {
            for (var i in obj) {
                base.setFieldValue(i, obj[i]);
            }
        };

        base.setElemValue = function (elem, val) {
            if (elem) {
                // TODO add support for checkboxes etc.
                return elem.val(val);
            } else {
                return false;
            }
        };

        base.getAttribute = function (element, attribute) {
            return base.getField(element + '_' + attribute);
        };

        base.getAttributes = function () {
            return $('.' + settings.cssInputPrefix + settings.attribute);
        };

        base.visitAttribute = function (attr, callback) {
            var elems = themeJSON.children;
            var root = settings.cssThemePrefix + base.nameToID(themeInfo.name);
            var dataElem = attr.attr('data-element');
            var dataAttr = attr.attr('data-attribute');
            var elem = elems[root + dataElem];
            callback(attr, elem, dataElem, dataAttr, root, elems);
        };

        base.persistAttributes = function (remove_default) {
            remove_default = CrayonUtil.setDefault(remove_default, true);
            base.getAttributes().each(function () {
                base.persistAttribute($(this), remove_default);
            });
        };

        base.persistAttribute = function (attr, remove_default) {
            remove_default = CrayonUtil.setDefault(remove_default, true);
            base.visitAttribute(attr, function (attr, elem, dataElem, dataAttr, root, elems) {
                if (elem) {
                    if (remove_default && attr.prop('tagName') == 'SELECT' && attr.val() == attr.attr('data-default')) {
                        // If default is selected in a dropdown, then remove
                        delete elem.attributes[dataAttr];
                        return;
                    }
                    val = base.getElemValue(attr);
                    if (val == null || val == '') {
                        // No value given
                        delete elem.attributes[dataAttr];
                        return;
                    } else {
                        val = base.addImportant(val);
                        elem.attributes[dataAttr] = val;
                        CrayonUtil.log(dataElem + ' ' + dataAttr);
                    }
                }
            });
        };

        base.populateAttributes = function ($change) {
            var elems = themeJSON.children;
            var root = settings.cssThemePrefix + base.nameToID(themeInfo.name);
            CrayonUtil.log(elems, root);
            base.getAttributes().each(function () {
                base.visitAttribute($(this), function (attr, elem, dataElem, dataAttr, root, elems) {
                    if (elem) {
                        if (dataAttr in elem.attributes) {
                            var val = base.removeImportant(elem.attributes[dataAttr]);
                            base.setElemValue(attr, val);
                            attr.trigger('change');
                        }
                    }
                });
            });
        };

        base.addImportant = function (attr) {
            if (!reImportant.test(attr)) {
                attr = attr + ' !important';
            }
            return attr;
        };

        base.removeImportant = function (attr) {
            return attr.replace(reImportant, '');
        };

        base.appendStyle = function (css) {
            previewCSS.html('<style>' + css + '</style>');
        };

        base.writeCSSInfo = function (info) {
            var infoStr = '/*\n';
            for (field in info) {
                infoStr += field + ': ' + info[field] + '\n';
            }
            return infoStr + '*/\n';
        };

        base.initUI = function () {
            // Bind events
            preview = $('#crayon-editor-preview');
            previewCSS = $('#crayon-editor-preview-css');
            status = $('#crayon-editor-status');
            title = $('#crayon-theme-editor-name');
            info = $('#crayon-theme-editor-info');
            $('#crayon-editor-controls').tabs();
            $('#crayon-editor-back').click(function () {
                if (changed) {
                    base.createDialog({
                        html: strings.discardConfirm,
                        title: strings.confirm,
                        yes: function () {
                            showMain();
                        }
                    });
                } else {
                    showMain();
                }
            });
            $('#crayon-editor-save').click(base.save);

            // Set up jQuery UI
            base.getAttributes().each(function () {
                var attr = $(this);
                var type = attr.attr('data-group');
                if (type == 'color') {
                    var args = {
                        parts: 'full',
                        showNoneButton: true,
                        colorFormat: '#HEX'
                    };
                    args.select = function (e, color) {
                        attr.trigger('change');
                    };
                    args.close = function (e, color) {
//                        attr.val(color.formatted);
//                        args.select(e, color);
                        attr.trigger('change');
                    };
                    attr.colorpicker(args);
                    attr.bind('change', function () {
                        var hex = attr.val();
                        attr.css('background-color', hex);
                        attr.css('color', CrayonUtil.getReadableColor(hex));
                    });
                } else if (type == 'size') {
                    attr.bind('change', function () {
                        var val = attr.val();
                        if (!reSize.test(val)) {
                            val = CrayonUtil.removeChars('^0-9-', val);
                            if (val != '') {
                                attr.val(val + 'px');
                            }
                        }
                    });
                }
                if (type != 'color') {
                    // For regular text boxes, capture changes on keys
                    attr.bind('keydown keyup', function () {
                        if (attr.attr(changedAttr) != attr.val()) {
                            CrayonUtil.log('triggering', attr.attr(changedAttr), attr.val());
                            attr.trigger('change');
                        }
                    });
                }
                // Update CSS changes to the live instance
                attr.bind('change', function () {
                    if (attr.attr(changedAttr) == attr.val()) {
                        return;
                    } else {
                        attr.attr(changedAttr, attr.val());
                    }
                    if (loaded) {
                        // For the preview we want to write defaults to override the loaded CSS
                        base.persistAttribute(attr, false);
                        base.updateLiveCSS();
                    }
                });
            });
        };

        base.updateLiveCSS = function () {
            if (previewCrayon) {
                var id = previewCrayon.attr('id');
                var json = $.extend(true, {}, themeJSON);
                $.each(json.children, function (child) {
                    json.children['#' + id + child] = json.children[child];
                    delete json.children[child];
                });
                base.appendStyle(CSSJSON.toCSS(json));
            }
        };

        base.updateUI = function () {
            $('#crayon-editor-controls input, #crayon-editor-controls select').bind('change', function () {
                changed = true;
            });
        };

        base.createInput = function (id, value, type) {
            value = CrayonUtil.setDefault(value, '');
            type = CrayonUtil.setDefault(type, 'text');
            return '<input id="' + settings.cssInputPrefix + id + '" class="' + settings.cssInputPrefix + type + '" type="' + type + '" value="' + value + '" />';
        };

        base.createForm = function (inputs) {
            var str = '<form class="' + settings.prefix + '-form"><table>';
            $.each(inputs, function (input) {
                str += '<tr><td class="field">' + input + '</td><td class="value">' + inputs[input] + '</td></tr>';
            });
            str += '</table></form>';
            return str;
        };

        var showMain = function () {
            admin.resetPreview();
            admin.preview_update();
            admin.show_theme_info();
            admin.show_main();
            //preview.html('');
        };

        base.updateTitle = function () {
            var name = base.getName();
            if (adminSettings.editing_theme) {
                title.html(strings.editingTheme.replace('%s', name));
            } else {
                title.html(strings.creatingTheme.replace('%s', name));
            }
        };

        base.updateInfo = function () {
            info.html('<a target="_blank" href="' + adminSettings.currThemeURL + '">' + adminSettings.currThemeURL + '</a>');
        };

        base.createPrompt = function (args) {
            args = $.extend({
                title: strings.prompt,
                text: strings.value,
                value: '',
                options: {
                    buttons: {
                        "OK": function () {
                            if (args.ok) {
                                args.ok(base.getFieldValue('prompt-text'));
                            }
                            $(this).dialog('close');
                        },
                        "Cancel": function () {
                            $(this).dialog('close');
                        }
                    },
                    open: function () {
                        base.getField('prompt-text').val(args.value).focus();
                    }
                }
            }, args);
            args.html = args.text + ': ' + base.createInput('prompt-text');
            base.createDialog(args);
        };

        base.createAlert = function (args) {
            args = $.extend({
                title: strings.alert,
                options: {
                    buttons: {
                        "OK": function () {
                            $(this).dialog('close');
                        }
                    }
                }
            }, args);
            base.createDialog(args);
        };

        base.createDialog = function (args) {
            var defaultArgs = {
                yesLabel: strings.yes,
                noLabel: strings.no,
                title: strings.confirm
            };
            args = $.extend(defaultArgs, args);
            var options = {
                modal: true, title: args.title, zIndex: 10000, autoOpen: true,
                width: 'auto', resizable: false,
                buttons: {
                },
                selectedButtonIndex: 1, // starts from 1
                close: function (event, ui) {
                    $(this).remove();
                }
            };
            options.open = function () {
                $(this).parent().find('button:nth-child(' + options.selectedButtonIndex + ')').focus();
            };
            options.buttons[args.yesLabel] = function () {
                if (args.yes) {
                    args.yes();
                }
                $(this).dialog('close');
            };
            options.buttons[args.noLabel] = function () {
                if (args.no) {
                    args.no();
                }
                $(this).dialog('close');
            };
            options = $.extend(options, args.options);
            $('<div></div>').appendTo('body').html(args.html).dialog(options);
            // Can be modified afterwards
            return args;
        }

    };

})(jQueryCrayon);
