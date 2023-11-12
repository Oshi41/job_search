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
    const Table = window.CustomTable;
    const [table_data, set_table_data] = useState([]);
    const [loading, set_loading] = useState(false);
    const [srv_loading, set_srv_loading] = useState(false);

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
                let result = [];
                for (let [name, {url, scraping, total}] of Object.entries(links))
                {
                    result.push({
                        name,
                        url,
                        scraping,
                        total
                    });
                }
                set_table_data(result);
                set_srv_loading(false);
            }
        } catch (e) {
            add_snackbar('Cannot get manual links: ' + e.message, 'error');
        } finally {
            set_loading(false);
        }
    }, []);
    useEffect(()=>void get_links(), []);

    const columns = useMemo(()=>{
        return [
            {
                id: 'name',
                header: 'Search',
                disable_filter: true,
                disable_sort: true,
                cell: x=>srv_loading || loading ? <Skeleton /> : <a href={x.url}>{x.name}</a>,
            },
            {
                id: 'total',
                header: 'Estimated count',
                disable_filter: true,
                disable_sort: true,
                cell: x=>srv_loading || loading ? <Skeleton /> : x.total,
            },
            {
                id: 'total',
                header: 'Actions',
                disable_filter: true,
                disable_sort: true,
                cell: x=>{
                    if (srv_loading || loading)
                        return <Skeleton />;

                    if (!x.scraping)
                        return <Button>Add to database</Button>;

                    if (x.scraping)
                        return <CircularProgress/>;
                },
            },
        ]
    }, [srv_loading, loading]);

    return <Stack direction='column'>
        <h3>Manual search</h3>
        <Typography>Use links below for manual vacancy search</Typography>
        <Table columns={columns}
               total={table_data.length}
               loading={loading || srv_loading}
               data={table_data}
               page={0}
               page_size={10}
               filter={{}}
               sort={{}}
        />
    </Stack>
}