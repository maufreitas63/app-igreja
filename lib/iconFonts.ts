/** Fontes de ícones em assets locais — evita URLs com node_modules no export web (Cloudflare). */
export const ICON_FONT_SOURCES = {
  FontAwesome: require('@/assets/fonts/FontAwesome.ttf'),
  'FontAwesome5Free-Brand': require('@/assets/fonts/FontAwesome5_Brands.ttf'),
  'FontAwesome5Free-Light': require('@/assets/fonts/FontAwesome5_Regular.ttf'),
  'FontAwesome5Free-Regular': require('@/assets/fonts/FontAwesome5_Regular.ttf'),
  'FontAwesome5Free-Solid': require('@/assets/fonts/FontAwesome5_Solid.ttf'),
  material: require('@/assets/fonts/MaterialIcons.ttf'),
} as const;
