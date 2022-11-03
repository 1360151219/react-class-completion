import { declare } from '@babel/helper-plugin-utils';
import { PluginObj, PluginPass } from '@babel/core';
import { removeQuota, removeTemplateLiteral } from '../helper';
import { IClassName } from '../types';

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
        const classname: IClassName[] = state.get('classname');
        // console.log('start', classname.length, StringLiteralReg.lastIndex);
        if (path.get('name').toString() === 'className') {
          let value = removeQuota(path.get('value').toString());
          if (StringLiteralReg.test(value)) {
            let m: RegExpExecArray | null;
            // 如果正则表达式是全局的，则在test或者exec方法调用的时候，它的lastIndex都会移动到匹配字符串的末尾。因此需要置0
            StringLiteralReg.lastIndex = 0;
            // 如果含有变量
            const originName = value;
            while ((m = StringLiteralReg.exec(value))) {
              const variablesMap = state.get('variables');
              value = value.replace(StringLiteralReg, variablesMap.get(m[1]));
            }
            classname.push({
              originName,
              className: removeTemplateLiteral(value),
              file: options.file,
              range: path.node.value?.loc,
            });
          } else {
            classname.push({
              originName: value,
              className: value,
              file: options.file,
              range: path.node.value?.loc,
            });
          }
        }
      },
    },
  };
  return pluginObj;
});
