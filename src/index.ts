import {
  type ApplicationInformation,
  AppWrapperRoute,
  defineWebApplication,
  type Extension,
  type SidebarPanelExtension,
  useClientService,
} from '@opencloud-eu/web-pkg';
import type {Resource, SpaceResource} from '@opencloud-eu/web-client';
import {computed, markRaw} from 'vue';
import {useGettext} from 'vue3-gettext';
import App from './App.vue';
import PreviewPanel from './components/PreviewPanel.vue';
import {BRAND, BRAND_MARK_DATA_URI} from './brand';
import {placeholderPreview} from './preview';
import {serializeProject} from './project';

const appId = BRAND.id;

function emptyProjectContent(fileName: string): string {
  const name = fileName.replace(new RegExp(`\\.${BRAND.extension}$`, 'i'), '') || 'Neue Steuerung';
  return serializeProject({
    format: 'blockberry',
    version: 1,
    name,
    savedAt: new Date().toISOString(),
    workspace: {blocks: {languageVersion: 0, blocks: []}},
    preview: placeholderPreview(name, 0),
  });
}

export default defineWebApplication({
  setup() {
    const {$gettext} = useGettext();
    const {webdav} = useClientService();
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
      icon: BRAND.icon,
      iconFillType: 'fill',
      color: BRAND.color,
      img: BRAND_MARK_DATA_URI,
      defaultExtension: BRAND.extension,
      meta: {
        fileSizeLimit: 5_000_000,
      },
      extensions: [
        {
          extension: BRAND.extension,
          mimeType: BRAND.mimeType,
          routeName,
          hasPriority: true,
          icon: BRAND.icon,
          iconColor: BRAND.color,
          label: () => $gettext('Edit with BlockBerry'),
          newFileMenu: {
            menuTitle: () => $gettext('BlockBerry project'),
            defaultName: () => $gettext('New BlockBerry project'),
          },
          createFileHandler: async ({fileName, space, currentFolder}) => {
            const folderPath = currentFolder.path?.replace(/\/?$/, '/') || '/';
            return webdav.putFileContents(space, {
              path: `${folderPath}${fileName}`,
              content: emptyProjectContent(fileName),
            });
          },
        } as NonNullable<ApplicationInformation['extensions']>[number],
      ],
    };

    const extensions = computed<Extension[]>(() => [
      {
        id: 'com.protronic.blockberry-editor.sidebar-preview',
        type: 'sidebarPanel',
        extensionPointIds: ['global.files.sidebar'],
        panel: {
          name: 'blockberry-preview',
          icon: BRAND.icon,
          iconFillType: 'fill',
          title: () => $gettext('BlockBerry'),
          component: markRaw(PreviewPanel),
          componentAttrs: (panelContext) => ({panelContext}),
          isVisible: ({items}) =>
            items?.length === 1 &&
            (items[0].extension === BRAND.extension ||
              !!items[0].name?.toLowerCase().endsWith(`.${BRAND.extension}`)),
        },
      } as SidebarPanelExtension<SpaceResource, Resource, Resource>,
    ]);

    return {
      appInfo,
      routes,
      extensions,
    };
  },
});
