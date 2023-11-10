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
    const VacancyView = window.VacancyView;

    let tabs = {
        'Vacancies': <VacancyView/>,
        'Scrape': <h1>In progress</h1>,
    };
    const [tab, set_tab] = useState(0);

    let tab_headers = useMemo(
        () => Object.keys(tabs).map((x, index) => <Tab label={x} value={index} key={index}/>),
        []);
    let tab_content = useMemo(() => Object.values(tabs)[tab], [tab]);

    return <Box>
        <Tabs value={tab} onChange={(e, i) => set_tab(i)}>{tab_headers}</Tabs>
        {tab_content}
    </Box>
}