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
    const {VacancyView, SettingsView, ScrapeView, ResumeView} = window;
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

    let props = {add_snackbar, close_snackbar};

    let tabs = {
        'Vacancies': <VacancyView {...props}/>,
        'Resumes': <ResumeView {...props}/>,
        'Settings': <SettingsView {...props}/>,
    };
    const [tab, set_tab] = useState(0);

    let tab_headers = useMemo(
        () => Object.keys(tabs).map((x, index) => <Tab label={x} value={index} key={index}/>),
        []);
    let tab_content = useMemo(() => Object.values(tabs)[tab], [tab]);

    return <Box>
        <Tabs value={tab} onChange={(e, i) => set_tab(i)}>{tab_headers}</Tabs>
        <div>
            {tab_content}
            <Snackbar open={snackbars.length > 0}
                      autoHideDuration={6000}
                      onClose={close_snackbar}>
                <Alert onClose={close_snackbar}
                       severity={snackbars[0] && snackbars[0].severity}
                       sx={{width: '100%'}}>
                    {snackbars[0] && snackbars[0].text}
                </Alert>
            </Snackbar>
        </div>
    </Box>
}