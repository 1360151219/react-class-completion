import { declare } from '@babel/helper-plugin-utils';
import { PluginObj, PluginPass } from '@babel/core';
import { removeQuota } from '../helper';
export default declare((api, options, dirname) => {
  const pluginObj: PluginObj<PluginPass> = {
    pre() {
      this.set('classname', options.classname);
    },
    visitor: {
      JSXAttribute: (path, state) => {
        const classname = state.get('classname');
        if (path.get('name').toString() === 'className') {
          classname.push(removeQuota(path.get('value').toString()));
        }
      },
    },
  };
  return pluginObj;
});
