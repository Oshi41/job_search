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
} = MaterialUI;

function install() {
    let root = document.getElementById('main_content');
    let react_root = ReactDOM.createRoot(root);
    react_root.render(<MainControl/>);
}

install();

function MainControl() {
    const {VacancyView, SettingsView, ScrapeView, ResumeMainView, CustomTabs} = window;
    const [snackbars, set_snackbars] = useState([]);
    /** @type {(function(string, 'error' | 'success' | 'warning' | 'info'): void)|*}*/
    const add_snackbar = useCallback((text, severity = 'info') => {
        set_snackbars(arr => {
            let copy = [...arr];
            copy.push({text, severity});
            return copy;
        })
    }, []);
    const close_snackbar = useCallback(() => set_snackbars(snackbars.slice(1)),
        [set_snackbars, snackbars]);
    const tabs = [
        {
            header: 'Vacancies',
            content: VacancyView,
        },
        {
            header: 'Resumes',
            content: ResumeMainView,
        },
        {
            header: 'Settings',
            content: SettingsView,
        },
    ];

    return <Box>
        <CustomTabs tabs={tabs}
                    tab_props={{add_snackbar}}
        />
        <Snackbar open={snackbars.length > 0}
                  autoHideDuration={6000}
                  onClose={close_snackbar}>
            <Alert onClose={close_snackbar}
                   severity={snackbars[0] && snackbars[0].severity}
                   sx={{width: '100%'}}>
                {snackbars[0] && snackbars[0].text}
            </Alert>
        </Snackbar>
    </Box>;
}