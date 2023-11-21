const {useState, useEffect, useMemo, useRef, useCallback} = React;
const {
    colors,
    CssBaseline,
    ThemeProvider,
    Typography,
    Container,
    createTheme,
    Box,
    Card,
    SvgIcon,
    Link,
    Paper,
    Popover,
    Switch,
    CircularProgress,
    Skeleton,
    Snackbar,
    Alert,
    IconButton,
    Icon,
    Stack,
    TextField,
    Tooltip,
    Button,
    Modal,
    Tab,
    Tabs,
    TextareaAutosize,
    FormControlLabel,
    MenuItem,
    InputLabel,
} = MaterialUI;

window.ResumeMainView = function (opts) {
    const {ResumeGenerateView, ResumeSettingsView, CustomTabs, use_increment_loading} = window;
    const [loading, set_loading] = use_increment_loading();
    const tabs = [
        {
            header: 'Settings',
            href: '/settings_tab',
            content: ResumeSettingsView,
        },
        {
            header: 'Generate',
            href: '/generate_tab',
            content: ResumeGenerateView,
        },
    ];
    return <Stack gap='8px' direction='column'>
        <Modal open={loading}>
            <CircularProgress sx={{
                width: '48px',
                height: '48px',
                margin: 'auto',
                display: 'block',
                marginTop: '10%',
            }}/>
        </Modal>
        <CustomTabs tab_props={{...opts, set_loading}}
                    tabs={tabs}
                    base_url='/resumes_tab'
        />,
    </Stack>
}