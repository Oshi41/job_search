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

window.ScrapeView = function ({add_snackbar}) {
    const [links, set_links] = useState({});
    const [loading, set_loading] = useState(false);
    const [srv_loading, set_srv_loading] = useState(false)

    const get_links = useCallback(async () => {
        try {
            set_loading(true);
            let res = await fetch('/links');
            let links = await res.json();
            if (links.loading)
            {
                set_srv_loading(true);
                setTimeout(get_links, 2000); // request again
            }
            else
            {
                set_links(links);
                set_srv_loading(false);
            }
        } catch (e) {
            add_snackbar('Cannot get manual links: ' + e.message, 'error');
        } finally {
            set_loading(false);
        }
    }, []);
    useEffect(()=>void get_links(), []);

    let controls = useMemo(() => {
        if (loading || srv_loading)
        {
            let skeleton = <Skeleton height={48} width={250}/>;
            return [skeleton, skeleton, skeleton];
        }
        let result = [];
        for (let [name, {url, total}] of Object.entries(links))
        {
            result.push(
                <li>
                    <a href={url}>{name+` [${total}]`}</a>
                </li>
            );
        }
        return result;
    }, [loading, links, srv_loading]);

    return <Stack direction='column'>
        <h3>
            <IconButton onClick={()=>get_links()}>
                <Icon>refresh</Icon>
            </IconButton>
            Manual search
        </h3>
        <Typography>Use links below for manual vacancy search</Typography>
        <ul>{controls}</ul>
    </Stack>
}