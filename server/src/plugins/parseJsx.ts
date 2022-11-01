import { declare } from '@babel/helper-plugin-utils';
import { PluginObj, PluginPass } from '@babel/core';
import { removeQuota, removeTemplateLiteral } from '../helper';

const StringLiteralReg = /\$\{([\d\w]+)\}/g;
export default declare((api, options, dirname) => {
  const pluginObj: PluginObj<PluginPass> = {
    pre() {
      this.set('classname', options.classname);
      this.set('variables', new Map());
    },
    visitor: {
      VariableDeclarator: (path, state) => {
        const variablesMap = state.get('variables');
        if (path.get('init').type === 'StringLiteral') {
          variablesMap.set(
            path.get('id').toString(),
            removeQuota(path.get('init').toString())
          );
        }
        state.set('variables', variablesMap);
      },
      JSXAttribute: (path, state) => {
        const classname = state.get('classname');
        // console.log('start', classname.length, StringLiteralReg.lastIndex);
        if (path.get('name').toString() === 'className') {
          let value = removeQuota(path.get('value').toString());
          if (StringLiteralReg.test(value)) {
            let m: RegExpExecArray | null;
            StringLiteralReg.lastIndex = 0;
            // 如果含有变量
            while ((m = StringLiteralReg.exec(value))) {
              const variablesMap = state.get('variables');
              value = value.replace(StringLiteralReg, variablesMap.get(m[1]));
            }
            classname.push(removeTemplateLiteral(value));
          } else {
            classname.push(value);
          }
        }
      },
    },
  };
  return pluginObj;
});
