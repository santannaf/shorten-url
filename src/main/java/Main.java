import server.AppServer;

void main(String[] args) throws Exception {
    int port = args.length > 0 ? Integer.parseInt(args[0]) : 8080;
    AppServer server = new AppServer(port);
    server.start();
}
