import { VIGILANCE_SCALES_UI } from '@/lib/dashboardCardThemes';
import { MINIMAL_SECTION_TITLE, MINIMAL_UI } from '@/lib/minimalUiTheme';
import { Platform, StyleSheet } from 'react-native';

/** Ícones azul escuro — identidade vigilance_scales / minimal. */
export const MEMBERS_CLASS_ICON_COLOR = '#1B4F8A';

const SURFACE = '#FFFFFF';
const TEXT = MINIMAL_UI.text;
const TEXT_MUTED = MINIMAL_UI.textMuted;
export const ACCENT = VIGILANCE_SCALES_UI.accent;
const DIVIDER = MINIMAL_UI.divider;
const HAIRLINE = StyleSheet.hairlineWidth;

export const membersClassStyles = StyleSheet.create({
  container: { flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, overflow: 'hidden', backgroundColor: SURFACE },
  containerEmbedded: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    alignSelf: 'stretch',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    backgroundColor: SURFACE,
  },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  titleCentered: {
    ...MINIMAL_SECTION_TITLE,
    marginVertical: 0,
    paddingVertical: 10,
  },
  readOnlyContainer: {
    backgroundColor: SURFACE,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderBottomWidth: HAIRLINE,
    borderBottomColor: DIVIDER,
  },
  readOnlyText: { color: ACCENT, fontWeight: '700', fontSize: 15 },
  membersList: {
    flex: 1,
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
  },
  membersListEmbedded: {
    width: '100%',
    maxWidth: '100%',
    minWidth: 0,
    flex: 1,
    minHeight: 0,
  },
  membersListContent: {
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  memberFormSection: {
    backgroundColor: SURFACE,
    marginBottom: 12,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: DIVIDER,
    overflow: 'hidden',
  },
  memberFormSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 12,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  memberFormSectionHeaderText: {
    flex: 1,
    paddingRight: 10,
  },
  memberFormSectionTitle: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '700',
  },
  memberFormSectionMeta: {
    color: TEXT_MUTED,
    fontSize: 12,
    marginTop: 2,
  },
  memberFormSectionBody: {
    paddingHorizontal: 4,
    paddingTop: 8,
    paddingBottom: 12,
  },
  memberFormSectionActions: {
    paddingTop: 4,
    paddingBottom: 8,
    gap: 10,
  },
  fieldLabel: {
    color: MINIMAL_UI.blueDark,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  fieldHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  nameSearchLoader: {
    marginBottom: 8,
  },
  nameSearchResults: {
    backgroundColor: SURFACE,
    borderRadius: 10,
    marginBottom: 12,
    maxHeight: 180,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
  },
  nameSearchResultRow: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: DIVIDER,
    backgroundColor: SURFACE,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : null),
  },
  nameSearchResultRowSelected: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderLeftWidth: 3,
    borderLeftColor: MINIMAL_UI.blueDark,
  },
  nameSearchResultName: {
    color: MINIMAL_UI.blueDark,
    fontSize: 14,
    fontWeight: '700',
  },
  nameSearchResultMeta: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  nameSearchEmpty: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    padding: 12,
  },
  nameSearchHint: {
    color: MINIMAL_UI.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  profileLookupMessage: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  profileLookupMessageSuccess: {
    color: ACCENT,
    fontWeight: '600',
  },
  profileLookupMessageMuted: {
    color: TEXT_MUTED,
  },
  membersListTitle: {
    marginTop: 4,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 96,
    paddingTop: 14,
    paddingBottom: 14,
  },
  input: {
    backgroundColor: SURFACE,
    color: MINIMAL_UI.blueDark,
    padding: 14,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: MINIMAL_UI.border,
    width: '100%',
    maxWidth: '100%',
  },
  scrollOptions: { marginBottom: 12, maxHeight: 50 },
  option: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: SURFACE,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: HAIRLINE,
    borderColor: DIVIDER,
  },
  optionSelected: { backgroundColor: ACCENT, borderColor: ACCENT },
  optionText: { color: TEXT },
  optionTextSelected: { color: MINIMAL_UI.onDark, fontWeight: '700' },
  addButton: {
    backgroundColor: ACCENT,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  addButtonText: { color: MINIMAL_UI.onDark, fontWeight: '700' },
  deleteMemberButton: {
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: ACCENT,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deleteMemberButtonDisabled: {
    opacity: 0.6,
  },
  deleteMemberButtonText: {
    color: ACCENT,
    fontWeight: '700',
  },
  cancelEditButton: {
    backgroundColor: MINIMAL_UI.rowHover,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelEditButtonText: {
    color: TEXT,
    fontSize: 12,
    fontWeight: '700',
  },
  memberRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    backgroundColor: SURFACE,
    borderBottomWidth: HAIRLINE,
    borderBottomColor: DIVIDER,
    flexDirection: 'column',
  },
  memberRowEditing: {
    backgroundColor: VIGILANCE_SCALES_UI.surfaceHighlight,
  },
  memberRowMain: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberContent: {
    flex: 1,
    minWidth: 0,
    marginRight: 8,
  },
  memberName: { color: TEXT, fontWeight: '700', fontSize: 15, flexShrink: 1 },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    maxWidth: '100%',
  },
  memberStatusDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
    flexShrink: 0,
  },
  memberStatusDotKids: {
    backgroundColor: '#FACC15',
  },
  memberStatusDotTeens: {
    backgroundColor: '#EF4444',
  },
  memberInfo: { color: TEXT_MUTED, fontSize: 12 },
  memberActionsColumn: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  acceptButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: HAIRLINE,
    borderColor: MEMBERS_CLASS_ICON_COLOR,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SURFACE,
  },
  acceptButtonPressed: {
    opacity: 0.85,
  },
  acceptButtonPending: {
    borderColor: ACCENT,
    opacity: 0.9,
  },
  acceptButtonChecked: {
    borderColor: ACCENT,
    backgroundColor: ACCENT,
  },
  acceptButtonUnchecked: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  editButton: {
    backgroundColor: ACCENT,
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerContainer: {
    backgroundColor: SURFACE,
    width: '100%',
    maxWidth: '100%',
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: HAIRLINE,
    borderTopColor: DIVIDER,
  },
  backButton: {
    backgroundColor: MINIMAL_UI.rowHover,
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  backButtonText: { color: TEXT, fontWeight: '700', fontSize: 14 },
});
