/*
 *  @module $Parser
 *  @desc Used to parse automation metadata into a human readable format
 *  
 *  @usage
 *    var result = new $Parser().convertData(record);
 */
var $Parser = (function() {
  'use strict';
  // internal vars
  var _n = '\n';
  var _processed = [];
  var _data = {};
  var _result;
  var _that;
  return {
    /*
     *  @method $Parser.convertData()
     *  @desc Converts the metadata of a given Tooling API record
     * 
     *  @param {Object} record - automation record
     * 
     *  @return {String} - returns the formatted process as a string
     */
    convertData: function(record) {
      var type = record.Type;
      _result = '';
      _data = JSON.parse(JSON.stringify(record.Metadata));
      _that = this;
      if (type == 'Workflow' || type == 'Flow') return _that.convertFlow();
      if (type == 'ValidationRule') return _that.convertRule();
      // for apex we already have the code in the Body field
      if (type == 'ApexClass' || type == 'ApexTrigger') return _data;
      if (type == 'WorkflowRule') return _that.convertWorkflow();
    },
    /*
     *  @method $Parser.convertRule()
     *  @desc Converts a ValidationRule record
     * 
     *  @return {String} - returns the formatted process as a string
     */
    convertRule: function() {
      _result += 'DESCRIPTION => ' + _data.description + _n;
      _result += 'CONDITION => ' + _data.errorConditionFormula + _n;
      // errorDisplayField is null if it's for the top of a page
      var display = _data.errorDisplayField == null ? 
        'Top of the page' : 'By the "' + _data.errorDisplayField + '" field';
      _result += 'ERROR DISPLAY => ' + display + _n;
      _result += 'ERROR MESSAGE => ' + _data.errorMessage;
      return _result;
    },
    /*
     *  @method $Parser.convertWorkflow()
     *  @desc Converts a Workflow record
     * 
     *  @return {String} - returns the formatted process as a string
     */
    convertWorkflow: function() {
      _result += 'DESCRIPTION => ' + _data.description + _n;
      _result += 'TRIGGER => ' + _data.triggerType + _n;
      // if booleanFilter is null the user has set custom match logic
      if (_data.booleanFilter != null) _result += 'LOGIC => ' + _data.booleanFilter + _n;
      _data.criteriaItems.forEach(function(c) {
        var condition = c.field + ' ' + c.operation + ' ' + c.value;
        _result += 'CONDITION => ' + condition + _n;
      });
      _result += '---' + _n;
      _data.actions.forEach(function(a) {
        _result += 'ACTION => ' + a.type + ' (' + a.name + ')' + _n;
      });
      // each workflow trigger can have more actions
      _data.workflowTimeTriggers.forEach(function(w) {
        _result += '---' + _n;
        // add schedule per workflow time trigger
        _result += 'SCHEDULED => ' + w.timeLength + ' ' + 
          w.workflowTimeTriggerUnit + ' FROM ' + w.offsetFromField + _n;
        w.actions.forEach(function(a) {
          _result += 'ACTION => ' + a.type + ' (' + a.name + ')' + _n;
        });
      })
      return _result;
    },
    /*
     *  @method $Parser.convertFlow()
     *  @desc Converts a Workflow or Flow record
     * 
     *  @return {String} - returns the formatted process as a string
     */
    convertFlow: function() {
      // get the starting decision
      var start = _data.decisions.map(function(d) {
        d._type = 'decision';
        return d;
      }).filter(function(d) {
        return d.name == _data.startElementReference;
      })[0];
      // if no start just process every decision
      if (start == undefined) {
        _that.processDecision(_data.decisions[0]);
        _data.decisions.forEach(function(d, i) {
          if (i != 0) _that.processDecision(d);
        });
      } else {
        // otherwise process the start first, then the rest
        _that.processDecision(start);
        _data.decisions.filter(function(d) {
          return d.name != _data.startElementReference;
        }).forEach(function(d) {
          _that.processDecision(d);
        });
      }
      return _result;
    },
    /*
     *  @method $Parser.processDecision()
     *  @desc Processes a decision block
     * 
     *  @return {Null}
     */
    processDecision: function(decision, wait) {
      if (!decision || _processed.indexOf(decision.name) != -1) return null;
      _processed.push(decision.name);
      // wait rules are used by the system but are not very helpful to humans
      var waitDecision = decision.name.indexOf('_myWait_') == -1;
      var prevDecision = decision.name.indexOf('_pmetdec') == -1
      if (wait != true && waitDecision && prevDecision) {
        _result += _n;
        _result += _n;
        _result += 'DECISION => ' + decision.label + _n;
      }
      var next;
      if (decision.defaultConnector) next = _that.getReference(decision.defaultConnector.targetReference);
      // check the rules if we have any
      if (decision.rules) {
        decision.rules.forEach(function(r) {
          _that.processRule(r);
        })
      }
      // if theres a next action process it
      if (next && _processed.indexOf(next.name) == -1) _that.processDecision(next); 
    },
    /*
     *  @method $Parser.processRule()
     *  @desc Processes a rule block
     * 
     *  @return {Null}
     */
    processRule: function(rule) {
      if (_processed.indexOf(rule.name) != -1) return null;
      _processed.push(rule.name);
      // wait rules are used by the system but are not very helpful to humans
      var waitRule = rule.name.indexOf('_myWait_') == -1;
      var prevRule = rule.name.indexOf('_pmetnullrule') == -1 && rule.name.indexOf('_pmetrule') == -1;
      // check if a wait rule
      if (waitRule && prevRule) _result += 'RULE => ' + rule.label + ' (' + rule.name + ')' + _n;
      // check conditions
      if (rule.conditions && waitRule && prevRule) {
        if (rule.conditions.length > 1) _result += 'LOGIC => ' + rule.conditionLogic + _n;
        rule.conditions.forEach(function(c) {
          _that.processCondition(c);
        })
      }
      // get next action if there is one
      var next;
      if (rule.connector) next = _that.getReference(rule.connector.targetReference);
      if (next && _processed.indexOf(next.name) == -1) {
        _that.processAction(next);
      }
    },
    /*
     *  @method $Parser.processCondition()
     *  @desc Processes a condition block
     * 
     *  @return {Null}
     */
    processCondition: function(condition) {
      var left = condition.leftValueReference;
      // get formula if left is a formula
      if (left.indexOf('formula') != -1) {
        for (var f = 0; f < _data.formulas.length; f++) {
          if (_data.formulas[f].name == left) left = _data.formulas[f].expression;
        }
      }
      var operator = condition.operator;
      var right = _that.getValue(condition.rightValue);
      var condition = left + ' ' + operator + ' ' + right;
      if (condition.trim() == 'true EqualTo true') condition = 'No conditions, just run the actions.';
      _result += 'CONDITION => ' + condition + _n;
    },
    /*
     *  @method $Parser.processAction()
     *  @desc Processes an action block
     * 
     *  @return {Null}
     */
    processAction: function(action, wait) {
      if (_processed.indexOf(action.name) != -1) return null;
      if (action._type == 'decision') return _that.processDecision(action, wait);
      _processed.push(action.name);
      _result += '---' + _n;
      var value = 'ACTION ';
      if (action.actionType == undefined) action.actionType = action._type;
      // check action type and create a message for it
      switch(action.actionType) {
        case 'emailAlert':
          value += '=> Send Email Alert (' + _that.getValue(action.processMetadataValues[0].value) + ')';
          break;
        case 'flow':
          value += '=> Run Flow (' + action.actionName + ')' + _n;
          break;
        case 'apex':
          value += '=> Run Apex (' + action.actionName + ')' + _n;
          break;
        case 'wait':
          value = '';
          break;
        case 'submit':
          var process = _that.getValue(action.processMetadataValues[0].value);
          if (process == 'firstFound') process = 'Default Approval Process';
          value += '=> Submit Approval (' + process + ')' + _n;
          break;
        case 'chatterPost':
          value += '=> Post To Chatter' + _n;
          break;
        case 'quickAction':
          value += '=> Quick Action (' + action.actionName + ')' + _n;
          break;
        case 'recordCreate':
          value += '=> Create Record (' + action.object + ')' + _n;
          break;
        case 'recordUpdate':
          value += '=> Update Record (' + action.object + ')' + _n;
          break;
        case 'assignment':
          if (action.name.indexOf('_myWait_') == -1) {
            var link = action.connector ? action.connector.targetReference : null;
            var assignsTo = _that.getReference(link);
            var name = assignsTo ? assignsTo.actionName : null;
            value = 'SYSTEM => Internally Assign Variables (' + name+ ')';
          } else {
            value = '';
          }
          break;
        default:
          value = '';
          if (action.name.indexOf('_myWait_') == -1) {
            console.log('UNKNOWN ACTION', action.actionType, action);
          }
      }
      if (value != '') _result += value;
      // check parameters
      if (action.inputParameters) {
        _result += _n;
        if (action.inputParameters.length > 0) _result += 'PARAMETERS =>' + _n;
        for (var p = 0; p < action.inputParameters.length; p++) {
          var param = action.inputParameters[p];
          _result += '  ' + param.name + ' = ' + _that.getValue(param.value) + _n;
        }
      }
      if (action.inputAssignments) {
        if (action.inputAssignments.length > 0) _result += 'PARAMETERS =>' + _n;
        for (var p = 0; p < action.inputAssignments.length; p++) {
          var param = action.inputAssignments[p];
          _result += '  ' + param.field + ' = ' + _that.getValue(param.value) + _n;
        }
      }
      // check waits
      if (action.waitEvents) {
        action.waitEvents.forEach(function(w) {
          _that.processWait(w);
        })
      }
      // check rules
      if (action.rules) {
        action.rules.forEach(function(r) {
          _that.processRule(r);
        })
      }
      // check if there is a next action
      var next;
      if (action.connector) next = _that.getReference(action.connector.targetReference);
      if (action.defaultConnector) next = _that.getReference(action.defaultConnector.targetReference);
      if (next && _processed.indexOf(next.name) == -1) _that.processAction(next);
    },
    /*
     *  @method $Parser.processWait()
     *  @desc Processes a wait block
     * 
     *  @return {Null}
     */
    processWait: function(wait) {
      if (_processed.indexOf(wait.name) != -1) return null;
      _processed.push(wait.name);
      var timer = [0, 0, 'AFTER', 0];
      wait.inputParameters.forEach(function(t) {
        if (t.name == 'TimeOffsetUnit') {
          var val = _that.getValue(t.value);
          timer[1] = val;
          // check if minus or plus
          if (val < 0) timer[2] = 'BEFORE';
        }
        if (t.name == 'TimeOffset') timer[0] = _that.getValue(t.value);
        if (t.name == 'TimeFieldColumnEnumOrId') timer[3] = _that.getValue(t.value);
      });
      if (timer[0] != 0) _result += 'SCHEDULED => ' + timer.join(' ').replace(/"/g, '') + _n;
      // check if there is a next action
      var next;
      if (wait.connector) next = _that.getReference(wait.connector.targetReference);
      if (next && _processed.indexOf(next.name) == -1) _that.processAction(next, true);
    },
    /*
     *  @method $Parser.getReference()
     *  @desc Finds a specific element based on a reference
     * 
     *  @return {Null}
     */
    getReference: function(name) {
      var match;
      function _forEach(items, type) {
        items.forEach(function(a) {
          if (a.name == name) {
            match = a;
            if (type) match._type = type;
          }
        })
      }
      _forEach(_data.actionCalls);
      _forEach(_data.assignments, 'assignment');
      _forEach(_data.decisions, 'decision');
      _forEach(_data.recordCreates, 'recordCreate');
      _forEach(_data.recordDeletes, 'recordDelete');
      _forEach(_data.recordLookups, 'recordLookup');
      _forEach(_data.recordUpdates, 'recordUpdate');
      _forEach(_data.waits, 'wait')
      return match;
    },
    /*
     *  @method $Parser.getValue()
     *  @desc Gets the value from a value block
     * 
     *  @return {Null}
     */
    getValue: function(value) {
      if (value == null) return null;
      if (value.stringValue != null) return '"' + value.stringValue.trim() + '"';
      if (value.booleanValue != null) return value.booleanValue;
      if (value.dateTimeValue != null) return value.dateTimeValue;
      if (value.dateValue != null) return value.dateValue;
      if (value.elementReference != null) return _that.getValue(_that.getElementReference(value.elementReference));
      if (value.numberValue != null) return value.numberValue;
      return value;
    },
    /*
     *  @method $Parser.getElementReference()
     *  @desc Gets the reference of a element formula
     * 
     *  @return {Null}
     */
    getElementReference: function(value) {
      if (value.indexOf('formula') != -1) {
        for (var f = 0; f < _data.formulas.length; f++) {
          if (_data.formulas[f].name == value) {
            return _data.formulas[f].processMetadataValues[0].value;
          }
        }
      }
      return null;
    }
  };
});