import {
  type ApplicationInformation,
  AppWrapperRoute,
  defineWebApplication,
} from '@opencloud-eu/web-pkg';
import {useGettext} from 'vue3-gettext';
import App from './App.vue';

const appId = 'blockberry-editor';

export default defineWebApplication({
  setup() {
    const {$gettext} = useGettext();
    const routeName = 'blockberry-editor-file';

    const routes = [
      {
        path: '/:driveAliasAndItem(.*)?',
        name: routeName,
        component: AppWrapperRoute(App, {
          applicationId: appId,
          fileContentOptions: {
            responseType: 'text',
          },
        }),
        meta: {
          authContext: 'hybrid',
          title: $gettext('BlockBerry Editor'),
          patchCleanPath: true,
        },
      },
    ];

    const appInfo: ApplicationInformation = {
      id: appId,
      name: $gettext('BlockBerry Editor'),
      icon: 'flow-chart',
      color: '#d63b65',
      defaultExtension: 'json',
      meta: {
        fileSizeLimit: 5_000_000,
      },
      extensions: [
        {
          extension: 'json',
          mimeType: 'application/json',
          routeName,
          label: () => $gettext('Edit with BlockBerry'),
          newFileMenu: {
            menuTitle: () => $gettext('BlockBerry project'),
          },
        },
      ],
    };

    return {
      appInfo,
      routes,
    };
  },
});
